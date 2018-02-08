'use strict';

const googleAssistantRequest = 'google';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
//const DialogflowApp = require('actions-on-google').DialogflowApp;

admin.initializeApp(functions.config().firebase);
var firestore = admin.firestore();

//var request = require('request');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.webhook = functions.https.onRequest((request, response) => {
    console.log("Value from user: " + request.body.result.parameters);

    let params = request.body.result.parameters;
    
    var  docRef = firestore.collection('someCollection').add(params)
        .then(() => {
            response.send({
                speech: `Hello ${params.Name}, We'd save you in our firestore database thanks to a cloud function !`,
                displayText: `Hello ${params.Name}, We'd save you in our firestore database thanks to a cloud function !`
            });
        }).catch((e => {
            console.log("Error firestore", e);
            response.send({
                speech: `Error while saving your data into our database`,
                displayText: `Error while saving your data into our database`
            });        
        })
    );
});


/*************************************************************
 ******* Utils Functions not used as DialogFlow process ******
 *************************************************************/

// This use <request> npm package to proceed the http call (npm install request)
// Http authentication and OAuth signing are available as described here (https://www.npmjs.com/package/request#table-of-contents)
// Pay attention that only connection inside Google domain (like Vision, cloud Platform, Storage, Datastore, ...) are allowed for free plan
/*function askApiInCloudFunction() {
    //This api provide random text as json only for test purpose
    request('https://jsonplaceholder.typicode.com/posts', function(error, response, body) {
        //Log are available in Firebase Cloud Function page for this app
        console.log('error: ', error);
        console.log('statusCode: ', response && response.statusCode);
        console.log('body: ', body);
    });
}*/

// GoogleAssistant has a different type of text processing
// This method adapt the text to the receiving device
function sendFormattedResponse(requestSource, text) {
    (requestSource === googleAssistantRequest)
        ? sendGoogleResponse('text')
        : sendResponse('Hello, Welcome to my Dialogflow agent!');
}

function sendGoogleResponse (responseToUser) {
    if (typeof responseToUser === 'string') {
      app.ask(responseToUser); // Google Assistant response
    } else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) {
        googleResponse = responseToUser.googleRichResponse;
      }
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      if (responseToUser.googleOutputContexts) {
        app.setContext(...responseToUser.googleOutputContexts);
      }
      console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
  }

function sendResponse() {

}