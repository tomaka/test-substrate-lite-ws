import * as substrate_lite from 'substrate-lite';
import * as fs from 'fs';
import { Buffer } from 'buffer';
import { default as websocket } from 'websocket';
import * as http from 'http';

let client = null;
var unsent_queue = [];
let ws_connection = null;

substrate_lite.start({
    chain_spec: Buffer.from(fs.readFileSync('./westend.json')).toString('utf8'),
    json_rpc_callback: (resp) => {
        if (ws_connection) {
            console.log("Sending back:", resp.slice(0, 100));
            ws_connection.sendUTF(resp);
        }
    }
})
    .then((c) => {
        client = c;
        unsent_queue.forEach((m) => client.send_json_rpc(m));
        unsent_queue = [];
    })
    
let server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(9944, function() {
    console.log((new Date()) + ' Server is listening on port 9944');
});

let wsServer = new websocket.server({
    httpServer: server,
    autoAcceptConnections: false,
});

wsServer.on('request', function(request) {
    var connection = request.accept(request.requestedProtocols[0], request.origin);
    console.log((new Date()) + ' Connection accepted.');
    ws_connection = connection;

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data.slice(0, 100));
            if (client) {
                client.send_json_rpc(message.utf8Data);
            } else {
                unsent_queue.push(message.utf8Data);
            }
        } else {
            throw "Unsupported type: " + message.type;
        }
    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        ws_connection = null;
    });
});
