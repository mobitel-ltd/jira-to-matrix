const assert = require('assert');
global.Olm = require('olm');
const sdk = require('matrix-js-sdk');
const MatrixClient = sdk.MatrixClient;
const HttpBackend = require("matrix-mock-request");

describe("MatrixClient opts", function() {
    const baseUrl = "http://localhost.or.something";
    let client = null;
    let httpBackend = null;
    const userId = "@alice:localhost";
    const userB = "@bob:localhost";
    const accessToken = "aseukfgwef";
    const roomId = "!foo:bar";

    beforeEach(function() {
        httpBackend = new HttpBackend();
    });

    afterEach(function() {
        httpBackend.verifyNoOutstandingExpectation();
    });

    describe("without opts.store", function() {
        beforeEach(function() {
            client = new MatrixClient({
                request: httpBackend.requestFn,
                baseUrl: baseUrl,
                userId: userId,
                accessToken: accessToken,
            });
        });

        afterEach(function() {
            client.stopClient();
        });

        it("should be able to send messages", function(done) {
            const eventId = "$flibble:wibble";
            httpBackend.when("PUT", "/txn1").respond(200, {
                event_id: eventId,
            });
            client.sendTextMessage("!foo:bar", "a body", "txn1").done(function(res) {
                assert.equal(res.event_id, eventId);
                done();
            });
            httpBackend.flush("/txn1", 1);
        });
    });
});
