/// <reference path="typings/index.d.ts" />

import express = require('express');        // call express
var app = express();                 // define our app using express

import ConnectionPool = require('tedious-connection-pool');
import tds = require('./app/utils/tds-promises');
import {TYPES} from 'tedious';
import passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var BearerStrategy = require('passport-azure-ad').BearerStrategy;
var bodyParser = require('body-parser');
var fs = require('fs'); //For SSL
var env = require('dotenv').load();
var moment = require('moment');
import kegController = require('./app/controllers/kegController');
import personController = require('./app/controllers/personController');
import sessionController = require('./app/controllers/session');
import queryExpression = require('./app/utils/query_expression');
import adminUserCache = require('./app/utils/admin_user_cache');

var config = {
    userName: process.env.SqlUsername,
    password: process.env.SqlPassword,
    server: process.env.SqlServer,
    options: {
        database: process.env.SqlDatabase,
        encrypt: true,
        rowCollectionOnRequestCompletion: true
    }
};
tds.default.setConnectionPool(new ConnectionPool({}, config));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* Azure AD */
app.use(passport.initialize());

passport.use(new BasicStrategy(async (username, password, done) => {
    var sql = "SELECT client_id, api_key " +
              "FROM SecurityTokens " +
              "WHERE client_id = @clientId and api_key = @apiKey";
    try {
        var results = await tds.default.sql(sql)
            .parameter('clientId', TYPES.NVarChar, username)
            .parameter('apiKey', TYPES.NVarChar, password)
            .executeImmediate();
        if (!results || results.length != 1) {
            return done(null, false, {message: 'Invalid client_id or api_key'});
        }
        else if (username.valueOf() == results[0].client_id && password.valueOf() == results[0].api_key) {
            return done(null, true);
        }
        return done(null, false, {message: 'Invalid client_id or api_key'});
    }
    catch (ex) {
        done(ex);
    }
}));
// OAuth bearer strategy for admin apis
passport.use(new BearerStrategy({  
        identityMetadata: process.env.AADMetadataEndpoint,
        clientID: process.env.ClientId,  
        audience: (process.env.AADAudience || "").split(';'),  
        validateIssuer: true,  
    }, async (token, done) => { 
        // Verify that the user associated with the supplied token is a member of our specified group
        if (await adminUserCache.isUserAdmin(token.oid)) {
            return done(null, token);
        }
        done(null, false);
    }));

/* Setting Port to 8000 */

var port = process.env.PORT || 8000;
var router = express.Router();

router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Cache-Control, Authorization");
    next();
});

router.get('/', function(req, res) {
    res.json({ message: 'Welcome to DX Liquid Intelligence api!' });   
});

var stdHandler = (handler: (req:express.Request, resultDispatcher:(resp:any)=>express.Response)=>void) => {
    return (req:express.Request, res:express.Response) => {
        handler(req, resp => {
            if (resp.code == 200) {
                return res.json(resp.msg);
            }
            else {
                return res.send(resp.code, resp.msg);
            }
        });
    };
};

var basicAuthStrategy = () => passport.authenticate('basic', {session: false});
var bearerOAuthStrategy = () => passport.authenticate('oauth-bearer', { session: false });

router.route('/isPersonValid/:card_id')
    .get(basicAuthStrategy(), stdHandler((req, resultDispatcher) => personController.getPersonByCardId(req.params.card_id, resultDispatcher)));

router.route('/kegs')
    .get(basicAuthStrategy(), stdHandler((req, resultDispatcher) => kegController.getKeg(null, resultDispatcher)))
    .post(bearerOAuthStrategy(), stdHandler((req, resultDispatcher) => kegController.postNewKeg(req.body, resultDispatcher)));

router.route('/activity/:sessionId?')
    .get(basicAuthStrategy(), stdHandler((req, resultDispatcher) => sessionController.getSessions(req.params.sessionId, new queryExpression.QueryExpression(req.query), resultDispatcher)))
    .post(basicAuthStrategy(), stdHandler((req, resultDispatcher) => sessionController.postNewSession(req.body, resultDispatcher)));

router.route('/CurrentKeg')
    .get(basicAuthStrategy(), stdHandler((req, resultDispatcher) => kegController.getCurrentKeg(null, resultDispatcher)));

//Get Current Keg for the TapId specified
router.route('/CurrentKeg/:tap_id')
    .get(basicAuthStrategy(), stdHandler((req, resultDispatcher) => kegController.getCurrentKeg(req.params.tap_id, resultDispatcher)))
    .put(bearerOAuthStrategy(), stdHandler((req, resultDispatcher) => kegController.postPreviouslyInstalledKeg(req.body.KegId, req.params.tap_id, req.body.KegSize, resultDispatcher)));

router.route('/users/:user_id?')
    .get(bearerOAuthStrategy(), stdHandler((req, resultDispatcher) => personController.getUserDetails(req.params.user_id || req.user.upn, resultDispatcher)))
    .put(bearerOAuthStrategy(), stdHandler((req, resultDispatcher) => personController.postUserDetails(req.params.user_id || req.user.upn, req.body, resultDispatcher)));

router.route('/kegFinished/:tap_id')
    .put(function(req, res){

    });

/*
//TODO: Using the isCurrent flag for now. Need to change the query to use PourDateTime instead.
router.route('/timeline')
    .get(function(req, res){
        var sqlStatement = "SELECT a.PourDateTime, b.FullName, d.Name as BeerName FROM dbo.FactDrinkers a INNER JOIN dbo.HC01Person b INNER JOIN dbo.FactKegInstall c INNER JOIN dbo.DimKeg d ON a.EmailName = b.HC01Person and a.TapId = c.TapId";
    });
*/

app.use('/api', router);

app.listen(port, function () {
    console.log('Listening on port: ' + port);
});

module.exports = {app};
