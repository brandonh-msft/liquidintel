"use strict";
require('mocha');
const chai = require("chai");
var chaiHttp = require('chai-http');
var server = require('../server').app;
chai.use(chaiHttp);
const request = require("request");
var should = chai.should();
var validBearerToken;
var invalidBearerToken;
before((done) => {
    request.post({
        url: `https://login.microsoftonline.com/${process.env.Tenant}/oauth2/token`,
        json: true,
        form: {
            'grant_type': 'refresh_token',
            'client_id': process.env.ClientId,
            'client_secret': process.env.ClientSecret,
            'resource': process.env.ClientId,
            'refresh_token': process.env.RefreshToken
        }
    }, (err, response, body) => {
        if (!err && response.statusCode == 200) {
            validBearerToken = body.access_token;
            console.log("Tests ready to start - server listening");
            done();
        }
        else {
            throw err || body;
        }
    });
});
describe('testing api', function () {
    it('should return 404 on / GET', function (done) {
        chai.request(server)
            .get('/')
            .end(function (err, res) {
            res.should.have.status(404);
            done();
        });
    });
    it('should respond with welcome to /api on /api GET', function (done) {
        chai.request(server)
            .get('/api')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.body.should.have.property('message');
            res.body.message.should.equal('Welcome to DX Liquid Intelligence api!');
            done();
        });
    });
    it('should list kegs on /api/kegs GET', function (done) {
        chai.request(server)
            .get('/api/kegs')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].should.have.property('KegId');
            res.body[0].should.have.property('Name');
            res.body[0].should.have.property('Brewery');
            res.body[0].should.have.property('BeerType');
            res.body[0].should.have.property('ABV');
            res.body[0].should.have.property('IBU');
            res.body[0].should.have.property('BeerDescription');
            res.body[0].should.have.property('UntappdId');
            res.body[0].should.have.property('imagePath');
            done();
        });
    });
    it('should require bearer token authentication on /api/kegs POST', function (done) {
        chai.request(server)
            .post('/api/kegs')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(401);
            done();
        });
    });
    it('should list current kegs on /api/CurrentKeg GET', function (done) {
        chai.request(server)
            .get('/api/CurrentKeg')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].should.have.property('KegId');
            res.body[0].should.have.property('Name');
            res.body[0].should.have.property('Brewery');
            res.body[0].should.have.property('BeerType');
            res.body[0].should.have.property('ABV');
            res.body[0].should.have.property('IBU');
            res.body[0].should.have.property('BeerDescription');
            res.body[0].should.have.property('UntappdId');
            res.body[0].should.have.property('imagePath');
            done();
        });
    });
    it('should get first current keg on /api/CurrentKeg/<id> GET', function (done) {
        chai.request(server)
            .get('/api/CurrentKeg/1')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].should.have.property('KegId');
            res.body[0].should.have.property('Name');
            res.body[0].should.have.property('Brewery');
            res.body[0].should.have.property('BeerType');
            res.body[0].should.have.property('ABV');
            res.body[0].should.have.property('IBU');
            res.body[0].should.have.property('BeerDescription');
            res.body[0].should.have.property('UntappdId');
            res.body[0].should.have.property('imagePath');
            should.not.exist(res.body[1]);
            done();
        });
    });
    it('should require bearer token authentication on /api/CurrentKeg/<id> PUT', function (done) {
        chai.request(server)
            .put('/api/CurrentKeg/1')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .send({ KegId: 6, KegSize: 17000 })
            .end(function (err, res) {
            res.should.have.status(401);
            done();
        });
    });
    it('should get all activities on /api/activity GET', function (done) {
        chai.request(server)
            .get('/api/activity')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].should.have.property('SessionId');
            res.body[0].should.have.property('PourTime');
            res.body[0].should.have.property('PourAmount');
            res.body[0].should.have.property('BeerName');
            res.body[0].should.have.property('Brewery');
            res.body[0].should.have.property('BeerType');
            res.body[0].should.have.property('ABV');
            res.body[0].should.have.property('IBU');
            res.body[0].should.have.property('BeerDescription');
            res.body[0].should.have.property('UntappdId');
            res.body[0].should.have.property('BeerImagePath');
            res.body[0].should.have.property('PersonnelNumber');
            res.body[0].should.have.property('Alias');
            res.body[0].should.have.property('FullName');
            done();
        });
    });
    it('should get specific activity on /api/activity/<id> GET', function (done) {
        chai.request(server)
            .get('/api/activity/1676')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.be.a('array');
            res.body[0].should.have.property('SessionId');
            res.body[0].should.have.property('PourTime');
            res.body[0].should.have.property('PourAmount');
            res.body[0].should.have.property('BeerName');
            res.body[0].should.have.property('Brewery');
            res.body[0].should.have.property('BeerType');
            res.body[0].should.have.property('ABV');
            res.body[0].should.have.property('IBU');
            res.body[0].should.have.property('BeerDescription');
            res.body[0].should.have.property('UntappdId');
            res.body[0].should.have.property('BeerImagePath');
            res.body[0].should.have.property('PersonnelNumber');
            res.body[0].should.have.property('Alias');
            res.body[0].should.have.property('FullName');
            should.not.exist(res.body[1]);
            done();
        });
    });
    it('should get valid specific person on /api/isPersonValid/<id> GET', function (done) {
        chai.request(server)
            .get('/api/isPersonValid/1801975')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.have.property('PersonnelNumber');
            res.body.should.have.property('Valid');
            res.body.should.have.property('FullName');
            res.body.Valid.should.equals(true);
            done();
        });
    });
    it('should get not valid specific person on /api/isPersonValid/<id> GET', function (done) {
        chai.request(server)
            .get('/api/isPersonValid/1958144')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.have.property('PersonnelNumber');
            res.body.should.have.property('Valid');
            res.body.should.have.property('FullName');
            res.body.Valid.should.equals(false);
            done();
        });
    });
    it('should 404 on invalid person on /api/isPersonValid/<id> GET', function (done) {
        chai.request(server)
            .get('/api/isPersonValid/0000000')
            .auth(process.env.BasicAuthUsername, process.env.BasicAuthPassword)
            .end(function (err, res) {
            res.should.have.status(404);
            done();
        });
    });
    it('should 401 on invalid bearer token on /api/users GET', function (done) {
        chai.request(server)
            .get('/api/users')
            .end(function (err, res) {
            res.should.have.status(401);
            done();
        });
    });
    it('should return user identified by access token for /api/users GET', function (done) {
        chai.request(server)
            .get('/api/users')
            .set('Authorization', 'Bearer ' + validBearerToken)
            .end((err, res) => {
            res.should.have.status(200);
            res.should.be.json;
            res.body.should.have.property('PersonnelNumber');
            done();
        });
    });
    it('should not find specific invalid user for /api/users/:user_id GET', function (done) {
        chai.request(server)
            .get('/api/users/blah@microsoft.com')
            .set('Authorization', 'Bearer ' + validBearerToken)
            .end((err, res) => {
            res.should.have.status(404);
            done();
        });
    });
    it('should return specific person that is a user for /api/users/:user_id GET', function (done) {
        chai.request(server)
            .get('/api/users/jamesbak@microsoft.com')
            .set('Authorization', 'Bearer ' + validBearerToken)
            .end((err, res) => {
            res.should.have.status(200);
            res.should.be.json;
            res.body.PersonnelNumber.should.be.above(420000);
            res.body.PersonnelNumber.should.be.below(430000);
            should.not.equal(res.body.UntappdAccessToken, null);
            done();
        });
    });
    it('should return specific person that is not a user for /api/users/:user_id GET', function (done) {
        chai.request(server)
            .get('/api/users/OLIVERH@microsoft.com')
            .set('Authorization', 'Bearer ' + validBearerToken)
            .end((err, res) => {
            res.should.have.status(200);
            res.should.be.json;
            res.body.PersonnelNumber.should.equal(52);
            should.equal(res.body.UntappdAccessToken, null);
            done();
        });
    });
});
//# sourceMappingURL=apitests.js.map