var express = require("express");
var mongoose = require("mongoose");
var User = require("../models/user");
var Exchange = require("../models/exchange");
var Pairing = require("../models/pairing");
var myAuthMiddleware = require("../my_auth_middleware");

var router = express.Router({mergeParams: true});

// Show info from exchanges user is participating in, link to create new exchange
router.get('/', myAuthMiddleware.isLoggedIn, myAuthMiddleware.isOwner, function(req, res){

    Pairing.find({ assignee: req.params.user_id })
    .populate({
        path: 'exchangeGroup',
        populate: {
            path: 'admin',
            model: 'User'
        }
    })
    .populate("pair")
    .exec(function(err, foundPairing){
        if(err){
            console.log(err);
        } else {
            res.render("exchange", {foundPairing: foundPairing});
        }
    })
});

// TODO:    ADMIN route
//          Create link for each exchange in exchanges page
//          Create admin page showing status of each pairing
//          Route for admin page
router.get('/:exchange_id/admin', myAuthMiddleware.isLoggedIn, myAuthMiddleware.isOwner, function(req, res){
    Exchange.findById(req.params.exchange_id)
    .populate({
        path: "pairings",
        populate: {
            path: "assignee",
            model: "User"
        }
    })
    .populate({
        path: "pairings",
        populate: {
            path: "pair",
            model: "User"
        }
    })
    .exec(function(err, foundExchange){
        if(err){
            console.log(err);
        } else {
            res.render('exchangeAdmin', {exchange: foundExchange});
        }
    })
})

// Show new exchange creation page
router.get('/new', myAuthMiddleware.isLoggedIn, myAuthMiddleware.isOwner, function(req, res){
    User.findById(req.user)
    .populate('friends')
    .exec(function(err, foundUser){
        if(err){
            console.log(err);
        } else {
            res.render('newExchange', {foundUser : foundUser});
        }
    })
})

// Process creation of new exchange
router.post('/addNew', myAuthMiddleware.isLoggedIn, myAuthMiddleware.isOwner, function(req, res){
    console.log("Hit new exchange creation route.");
    // List of participant ID strings
    let idStrings = req.body.newExchange.members; // This will be used later
    // Convert array of user ID strings to User ID objects
    let participantIds = idStrings.map(id => mongoose.Types.ObjectId(id));
    // Add current user to list of participants
    participantIds.push(req.user._id);
    // Get User database entries for each participant
    User.find({
        '_id': { $in: participantIds }
    }, function(err, foundIds){
        if(err){
            console.log(err);
        } else {
            Exchange.create({}, function(err, createdExchange){
                if(err){
                    console.log(err)
                } else {
                    createdExchange.members = foundIds;
                    createdExchange.admin = req.user;
                    createdExchange.spendLimit = req.body.newExchange.spendLimit;
                    createdExchange.name = req.body.newExchange.name;
                    createdExchange.save();

                    // Save this exchange to each user's joinedExchanges attribute
                    foundIds.forEach(function(user){
                        user.joinedExchanges.push(createdExchange._id);
                        user.save();
                    })

                    // Create a list of objects to pass for pairing creation
                    let pairingCreationList = [];
                    createdExchange.members.forEach(function(member){
                        var addAssigneeObject = {};
                        addAssigneeObject.assignee = member;
                        pairingCreationList.push(addAssigneeObject);
                    });

                    // Create initial pairing objects with list of participants.
                    // Pairs will not be assigned yet. Only the "assignee" field
                    // will be filled
                    Pairing.create(pairingCreationList, function(err, createdPairings){
                        if(err){
                            console.log(err);
                        } else {

                            // Getting actual pairs here. First duplicate and shuffle list of
                            // participants, then try to match them by looping over the original list
                            // and comparing it to the last entry in the shuffled list.
                            // If the last entry doesn't match, pair them up. If it does,
                            // pair with the first entry.

                            // Shuffle original list
                            let shuffledList = shuffle(createdExchange.members.slice());

                            // Loop over original list and test for matches
                            // Also add exchange's id to exchangeGroup attribute
                            // Also add pairings to exchange object
                            createdPairings.forEach(function(pairing){
                                let endOfList = shuffledList[shuffledList.length - 1];
                                if(!pairing.assignee._id.equals(endOfList._id)){
                                    // Person at end of list did not match assignee, making a pair.
                                    pairing.pair = shuffledList.pop();
                                } else {
                                    // Person at end of list matched assignee, making pair from first
                                    // person on list.
                                    pairing.pair = shuffledList.shift();
                                }
                                pairing.exchangeGroup = createdExchange;
                                pairing.save();
                                createdExchange.pairings.push(pairing._id);
                            })
                            createdExchange.save();
                            res.redirect(`/user/${req.user.id}/exchange/`);
                        }
                    })
                }
            })
        }
    })
})

// Update pairing comments
router.post('/:exchange_id/updatePairingNotes', function(req, res){
    // Note to self: req.body contains whatever is sent in the "data"
    // attribute through the ajax method's argument object
    let notes = req.body.notes;

    // Look up pairing of current user and pairing obj for whwhever
    // current user is pair. Update messages.
    Pairing.find({assignee: req.user._id, exchangeGroup: req.params.exchange_id }, function(err, foundWhereAssignee){
        if(err){
            console.log(err);
        } else {
            Pairing.find({pair: req.user._id, exchangeGroup: req.params.exchange_id}, function(err, foundWherePair){
                if(err){
                    console.log(err);
                } else {
                    // Note: the Document.find() method returns an array, even if there is only one result. Thus,
                    // I have to use [0] to access the actual Document objects here.

                    foundWhereAssignee[0].notesForPair =notes;
                    foundWherePair[0].notesFromPair = notes;
                    foundWhereAssignee[0].save();
                    foundWherePair[0].save();
                    res.json({success: true});
                }
            })
        }
    })
})

router.put('/:pairing_id/updatePairingStatus', function(req, res){
// Update pairing gift purchase status
    Pairing.findById(req.params.pairing_id, function(err, foundPairing){
        if(err){
            console.log(err);
        } else {
            if(foundPairing.status === "No."){
                foundPairing.status = "Yes.";
                foundPairing.save();
                res.json({
                    htmlText: 'Did you buy a gift: Yes!',
                    buttonText: "Reset"
                });
            } else {
                foundPairing.status = "No.";
                foundPairing.save();
                res.json({
                    htmlText: 'Did you buy a gift? No.',
                    buttonText: "I bought it!"
                });
            }
        }
    })
})


// ------ FUNCTIONS ---------------

function assignPairs(participantList){
    let pairingList = shuffle(participantList.slice());

    participantList.forEach(function(assignee){
        console.log('pairing:');
        console.log('assignee: ', assignee.firstName);
        // Check to see if last entry of pairing list matches original list
        // If it doesn't, add as pair
        if(pairingList[pairingList.length - 1]._id.equals(assignee._id)){
            
        } else {
            console.log('did not match at end of list')
            console.log('pair:',pairingList.pop().firstName);
        }
        // console.log("\n");
        // console.log(`assignee._id:\n`,assignee._id)
        // console.log(`last obj id on pairingList:\n`, pairingList[pairingList.length -1]._id);
        // console.log(`first obj id on pairingList:\n`, pairingList[0]._id);
        console.log('\n');
    })
}

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }


module.exports = router;