
import express = require('express');
import tds = require('../utils/tds-promises');
import {TYPES} from 'tedious';
import untappd = require('../utils/untappd')

export function getCurrentKeg_Internal(tapId: number): Promise<any[]> {
    return new Promise<any[]>(async (resolve, reject) => {
        try {
            var sqlStatement = "SELECT i.TapId, i.InstallDate, i.kegSizeInML, i.currentVolumeInML, " + 
                            "    k.Id as KegId, k.Name, k.Brewery, k.BeerType, k.ABV, k.IBU, " +
                            "    k.BeerDescription, k.UntappdId, k.imagePath " +
                            "FROM FactKegInstall i INNER JOIN DimKeg k ON i.KegId = k.Id " +
                            "WHERE i.isCurrent = 1 ";
            if (tapId != null) {
                sqlStatement += "AND i.TapId = @tap_id"
            }
            var stmt = tds.default.sql(sqlStatement);
            if (tapId != null) {
                stmt.parameter('tap_id', TYPES.Int, tapId);
            }
            let results = await stmt.executeImmediate();
            resolve(results.map(row => {
                return {
                    'TapId': row.TapId,
                    'KegId': row.KegId,
                    'InstallDate': row.InstallDate,
                    'KegSize': row.kegSizeInML,
                    'CurrentVolume': row.currentVolumeInML,
                    'Name': row.Name,
                    'Brewery': row.Brewery,
                    'BeerType': row.BeerType,
                    'ABV': row.ABV,
                    'IBU': row.IBU,
                    'BeerDescription': row.BeerDescription,
                    'UntappdId': row.UntappdId,
                    'imagePath': row.imagePath
                };
            }));
        }
        catch (ex) {
            reject(ex);
        }
    });
}

// This is the method callable via express routes - the outputFunc will send output to an express.Response object
export async function getCurrentKeg(tapId: number, outputFunc: (resp:any) => express.Response) {
    try {
        let results = await getCurrentKeg_Internal(tapId);
        if (tapId != null && results.length == 0) {
            outputFunc({code: 404, msg:'Current Keg(s) Not Found!'});
        }
        outputFunc({ code: 200, msg: results});
    }
    catch (ex) {
        outputFunc({code: 500, msg: ex});
    }
}

export async function postPreviouslyInstalledKeg(kegId: number, tapId: number, kegSize: number, outputFunc: (resp:any) => express.Response) {
    var inXact = false;
    var connection: tds.TdsConnection;
    try {
        connection = new tds.TdsConnection();
        await connection.open();
        await connection.beginTransaction();
        inXact = true;
        // Deactivate any current kegs on this tap
        var sqlStatement = "UPDATE FactKegInstall " +
                           "SET isCurrent = 0 " + 
                           "WHERE TapId = @tapId";
        await connection.sql(sqlStatement)
            .parameter("tapId", TYPES.Int, tapId)
            .execute(false);
        // Install the new keg on the specified tap
        sqlStatement = "INSERT INTO FactKegInstall (TapId, KegId, InstallDate, kegSizeInML, currentVolumeInML, isCurrent) " +
                       "VALUES (@tapId, @kegId, @installDate, @kegSize, @kegSize, 1)";
        await connection.sql(sqlStatement)
            .parameter("tapId", TYPES.Int, tapId)
            .parameter("kegId", TYPES.Int, kegId)
            .parameter("installDate", TYPES.DateTime2, new Date(Date.now()))
            .parameter("kegSize", TYPES.Decimal, kegSize)
            .execute(false);

        await connection.commitTransaction();
        inXact = false;
        getCurrentKeg(tapId, outputFunc);
    }
    catch (ex) {
        if (inXact) {
            await connection.rollbackTransaction();
        }
        outputFunc({code: 500, msg: "Failed to post new keg: " + ex});
    }
    finally {
        if (connection) {
            connection.close();
        }
    }
}

export async function getKeg(kegId: number, outputFunc: (resp:any) => express.Response) {
    try {
        var sqlStatement = "SELECT k.Id, k.Name, k.Brewery, k.BeerType, k.ABV, k.IBU, " +
                           "    k.BeerDescription, k.UntappdId, k.imagePath " +
                           "FROM DimKeg k ";
        if (kegId != null) {
            sqlStatement += "WHERE Id = @keg_id";
        }
        var stmt = tds.default.sql(sqlStatement);
        if (kegId != null) {
            stmt.parameter('keg_id', TYPES.Int, kegId);
        }
        let results = await stmt.executeImmediate();
        return outputFunc({ code: 200, msg: results.map(row => {
                return {
                    'KegId': row.Id,
                    'Name': row.Name,
                    'Brewery': row.Brewery,
                    'BeerType': row.BeerType,
                    'ABV': row.ABV,
                    'IBU': row.IBU,
                    'BeerDescription': row.BeerDescription,
                    'UntappdId': row.UntappdId,
                    'imagePath': row.imagePath
                };
            })});
    }
    catch (ex) {
        return outputFunc({code: 500, msg:'Internal Error: ' + ex});
    }
}

export async function postNewKeg(body: any, output: (resp:any) => express.Response) {
    try {
        // If they've supplied an Untapped beer id, look this up now
        if (body.UntappdId && untappd.isIntegrationEnabled) {
            var beerInfo = await untappd.getBeerInfo(body.UntappdId);
            body.Name = beerInfo.beer_name;
            body.Brewery = beerInfo.brewery_name;
            body.BeerType = beerInfo.beer_style;
            body.ABV = beerInfo.beer_abv;
            body.IBU = beerInfo.beer_ibu;
            body.BeerDescription = beerInfo.beer_description;
            body.imagePath = beerInfo.beer_label_image;
        }
        var sqlStatement = "INSERT INTO DimKeg " +
                        "(Name, Brewery, BeerType, ABV, IBU, BeerDescription, UntappdId, imagePath) " + 
                        "VALUES (@name, @brewery, @beerType, @abv, @ibu, @beerDescription, @UntappdId, @imagePath); " +
                        "SELECT SCOPE_IDENTITY() as Id;"
        var results = await tds.default.sql(sqlStatement)
            .parameter("name", TYPES.NVarChar, body.Name)
            .parameter("brewery", TYPES.NVarChar, body.Brewery)
            .parameter("beerType", TYPES.NVarChar, body.BeerType)
            .parameter("abv", TYPES.NVarChar, body.ABV)
            .parameter("ibu", TYPES.NVarChar, body.IBU)
            .parameter("beerDescription", TYPES.NVarChar, body.BeerDescription)
            .parameter("UntappdId", TYPES.Int, body.UntappdId)
            .parameter("imagePath", TYPES.NVarChar, body.imagePath)
            .executeImmediate();
        getKeg(results[0].Id, output);
    }
    catch (ex) {
        output({code: 500, msg: 'Internal error: ' + ex});
    }
}
    
//TODO
export function putKegFinished(tapId, outputFunc) {
    var markKegAsFinished = "UPDATE dbo.FactKegInstall SET isCurrent=0 WHERE tapId=@tap_id and isCurrent=1";
}
