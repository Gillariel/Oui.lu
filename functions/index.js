'use strict';

const googleAssistantRequest = 'google';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const DialogflowApp = require('actions-on-google').DialogflowApp;

admin.initializeApp(functions.config().firebase);
var firestore = admin.firestore();

var request = require('request');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.webhook = functions.https.onRequest((request, response) => {
    let action = request.body.result.action;
    let deviceSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
    let params = request.body.result.parameters;
    var text;
    // Associate functions to each possible actions. Better performance than a simple switch
    const actionHandlers = {
        'input.welcome': () => {
            text = "some Text";
            sendFormattedResponse(deviceSource, text, response);
        },
        'input.selection_trip': () => {
            var prices = `Les prix sont : `;
            var trainsRef = firestore.collection('trains');
            var train = trainsRef.where('departure', '==', 'Bruxelles').where('arrival', '==', 'Paris').get()
                .then(snapShot => {
                    snapShot.forEach(doc => {
                        console.log(doc.id, '=>', doc.data().price);
                        prices.concat(`${doc.data().price} - `);
                    });
                    sendResponse(prices, response);
                })
                .catch(e => {
                    sendResponse('Error while retrieving data from database', response);
                })
        },
        'firestore.testAddData': () => {
            text = `Data saved (${params.Name})`;
            f_save('someCollection', params, void 0, function(res){
                res
                    ? sendFormattedResponse(deviceSource, `Saving your data successfully (${params.Name})`, response)
                    : sendFormattedResponse(deviceSource, `Sorry ${params.Name}, an error has occured while saving you`, response); 
            });
            //addSimpleData(params);
        }, 
        'firestore.testRetrieveData': () => {
            retrieveSimpleData(deviceSource, response);
        },
        'firestore.testDelete': () => {
            f_deleteCollection(params.CollectionName, 10, function(res) {
                res
                    ? sendFormattedResponse(deviceSource, `Collection ${params.CollectionName} has been deleted`, response)
                    : sendFormattedResponse(deviceSource, `Sorry an error has occured while saving you`, response); 
            });
        },
        'outsideApi.test': () => {

        }
    };

    if (!actionHandlers[action]) {
        action = 'default';
    }
    // Run the proper handler function
    actionHandlers[action]();
});

/*************************************************************
 ******************* Firestore Functions *********************
 *************************************************************/

 // Add a simple Name to database
function addSimpleData(nameObject) {  
    var docRef = firestore.collection('someCollection').add(nameObject)
    .then(() => {
        sendFormattedResponse(`Hello ${nameObject.Name}, We'd save you in our firestore database thanks to a cloud function !`, null);
    }).catch((e => {
        console.log("Error firestore", e);
        sendFormattedResponse(`Error while saving your data into our database`);        
    }));
}

// Retrieve a Simple Name from Database
function retrieveSimpleData(source, response) {  
    var docRef = firestore.collection('someCollection').doc('VoBA6t5GxdIEA79Gjp0H').get()
    .then(function(snap) {
        sendFormattedResponse(source, `Hello ${snap.data().Name}, retrieve data`, response);
    }).catch((e => {
        console.log("Error firestore", e);
        sendFormattedResponse(source, `Error while saving your data into our database`, response);        
    }));
}

// Generic method for saving a single document
function f_save(collectionName, jsonData, documentName, callback){
    if (typeof documentName === 'undefined') {
        // Use autogenerated ID for this document
        firestore.collection(collectionName)
        .add(jsonData)
        .then(() => {
            // Data has been saved
            callback(true);
        }).catch((e => {
            // Error occured
            console.log("Error firestore", e);
            callback(false);
        }));
    } else {
        firestore.collection(collectionName).doc(documentName).set(jsonData)
        .then(() => {
            // Data has been saved
            callback(true);
        }).catch((e => {
            // Error occured
            console.log("[Create Single] Error firestore", e);
            callback(false);
        }));
    }
}

// Generic method for saving a List of document with rollback on error
// If documentName is specified, EACH ELEMENT OF DATA NEED TO CONTAINS A PROPERTY Name
function f_saveList(collectionName, jsonData, documentName){
    var batch = firestore.batch();
    if (typeof documentName === 'undefined') {
        // Use autogenerated ID for this document
        var collectionRef = firestore.collection(collectionName);
        jsonData.forEach(element => {
            batch.add(collectionRef, element);
        });
    } else {
        var collectionRef = firestore.collection(collectionName);
        var docRef;
        jsonData.forEach(element => {
            docRef = collectionRef.doc(element.Name);
            batch.set(docRef, element);
        });
    }
    return batch.commit.then(function() {
        // All batch is complete without error
    });
}

// Generic method for updating a single document (note that save function on existing document works too)
// DocumentName IS NEED HERE
function f_update(collectionName, jsonData, documentName){
    firestore.collection(collectionName).doc(documentName).update(jsonData)
    .then(() => {
        // Data has been updated
    }).catch((e => {
        // Error occured
        console.log("[Updating] Error firestore", e);
    }));
}

// Generic method for updating a List of document (note that save function on existing documents works too)
// DocumentName IS NEED HERE (and is an array here)
function f_updateList(collectionName, jsonData, documentName){
    var batch = firestore.batch();
    var collectionRef = firestore.collection(collectionName);
    jsonData.forEach(element => {
        batch.set(collectionRef.doc(element.Name), element);
    });
    return batch.commit.then(function() {
        // All batch is complete without error
    });
}

// Generic method for deleting a single document
function f_delete(collectionName, documentName){
    firestore.collection(collectionName)
    .doc(documentName)
    .delete()
    .then(() => {
        // Deleted successfull
    }).catch((e) => {
        // Error occured
        console.log("[Deleting] Error Firestore");
    });
}

// Delete a complete collection (use batchSize according to the number of doc to delete)
function f_deleteCollection(collectionName, batchSize, callback){
    var collectionRef = firestore.collection(collectionName);
    var query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, batchSize, resolve, reject);
    }).then(() => {
        callback(true);
    }).catch((e => {
        callback(false);
    }));
    
}

// Do multiple delete recursivle using batch
function deleteQueryBatch(query, batchSize, resolve, reject) {
    query.get()
        .then((snapshot) => {
            if (snapshot.size == 0)
                return 0;

            var batch = firestore.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            return batch.commit().then(() => {
                return snapshot.size;
            });
        }).then((numDeleted) => {
            if (numDeleted === 0) {
                resolve();
                return;
            }
            process.nextTick(() => {
                deleteQueryBatch(query, batchSize, resolve, reject);
            });
        })
        .catch(reject);
}

/*************************************************************
 ******* Utils Functions not used as DialogFlow process ******
 *************************************************************/

// This use <request> npm package to proceed the http call (npm install request)
// Http authentication and OAuth signing are available as described here (https://www.npmjs.com/package/request#table-of-contents)
// Pay attention that only connection inside Google domain (like Vision, cloud Platform, Storage, Datastore, ...) are allowed for free plan
function askApiInCloudFunction() {
    //This api provide random text as json only for test purpose
    request('https://jsonplaceholder.typicode.com/posts', function(error, response, body) {
        //Log are available in Firebase Cloud Function page for this app
        console.log('error: ', error);
        console.log('statusCode: ', response && response.statusCode);
        console.log('body: ', body);
    });
}

// GoogleAssistant has a different type of text processing
// This method adapt the text to the receiving device
function sendFormattedResponse(requestSource, text, response) {
    (requestSource === googleAssistantRequest)
        ? sendGoogleResponse(text)
        : sendResponse(text, response);
}

function sendGoogleResponse (responseToUser) {
    if (typeof responseToUser === 'string')
      app.ask(responseToUser); // Google Assistant response
    else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) 
        googleResponse = responseToUser.googleRichResponse;
      // Optional: add contexts
      if (responseToUser.googleOutputContexts) 
        app.setContext(...responseToUser.googleOutputContexts);
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
}

function sendResponse(responseToUser, response) {
    if (typeof responseToUser === 'string') {
        let responseJson = {};
        responseJson.speech = responseToUser; // spoken response
        responseJson.displayText = responseToUser; // displayed response
        response.json(responseJson); // Send response to Dialogflow
    } else {
        // If the response to the user includes rich responses or contexts send them to Dialogflow
        let responseJson = {};
        // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
        responseJson.speech = responseToUser.speech || responseToUser.displayText;
        responseJson.displayText = responseToUser.displayText || responseToUser.speech;
        // Optional: add rich messages for integrations
        responseJson.data = responseToUser.data;
        // Optional: add contexts
        responseJson.contextOut = responseToUser.outputContexts;
        console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
        response.json(responseJson); // Send response to Dialogflow
    }
}

//Build Rich Response for DialogFlow V1 Response
function buildRichResponse(responseText, suggestions, cardText, subtitle, title, buttonText, buttonUrl, image) {
    const app = new DialogflowApp();
    const googleRichResponse = app.buildRichResponse()
        .addSimpleResponse(responseText)
        .addSuggestions(suggestions)
        // Create a basic card and add it to the rich response
        .addBasicCard(app.buildBasicCard(cardText)
        .setSubtitle(subtitle)
        .setTitle(title)
        .addButton(buttonText, buttonUrl)
        .setImage(image, 'Image alternate text'))
        .addSimpleResponse({ speech: 'This is another simple response',
                            displayText: 'This is the another simple response 💁' });
}

// Basic example of Rich Response use.
const app = new DialogflowApp();
const googleRichResponse = app.buildRichResponse()
    .addSimpleResponse('This is the first simple response for Google Assistant')
    .addSuggestions(
        ['Suggestion Chip', 'Another Suggestion Chip'])
        // Create a basic card and add it to the rich response
    .addBasicCard(app.buildBasicCard(`This is a basic card.  Text in a
        basic card can include "quotes" and most other unicode characters
        including emoji 📱.  Basic cards also support some markdown
        formatting like *emphasis* or _italics_, **strong** or __bold__,
        and ***bold itallic*** or ___strong emphasis___ as well as other things
        like line  \nbreaks`) // Note the two spaces before '\n' required for a
                            // line break to be rendered in the card
    .setSubtitle('This is a subtitle')
    .setTitle('Title: this is a title')
    .addButton('This is a button', 'https://assistant.google.com/')
    .setImage('https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
        'Image alternate text'))
    .addSimpleResponse({ speech: 'This is another simple response',
                        displayText: 'This is the another simple response 💁' });
// Rich responses for Slack and Facebook for v1 webhook requests
const richResponsesV1 = {
    'slack': {
        'text': 'This is a text response for Slack.',
        'attachments': [
            {
                'title': 'Title: this is a title',
                'title_link': 'https://assistant.google.com/',
                'text': 'This is an attachment.  Text in attachments can include \'quotes\' and most other unicode characters including emoji 📱.  Attachments also upport line\nbreaks.',
                'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
                'fallback': 'This is a fallback.'
            }
        ]
    },
    'facebook': {
        'attachment': {
            'type': 'template',
            'payload': {
                'template_type': 'generic',
                'elements': [
                    {
                        'title': 'Title: this is a title',
                        'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
                        'subtitle': 'This is a subtitle',
                        'default_action': {
                            'type': 'web_url',
                            'url': 'https://assistant.google.com/'
                        },
                        'buttons': [
                            {
                                'type': 'web_url',
                                'url': 'https://assistant.google.com/',
                                'title': 'This is a button'
                            }
                        ]
                    }
                ]
            }
        }
    }
};