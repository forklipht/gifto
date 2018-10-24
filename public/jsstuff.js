console.log("Loaded js_stuff.js");
//-------------- ITEM PAGE-----------------

//set purchase status with respect to buttons
$(document).ready(function(){
    if($('#purchase-status-value').val()){
        let purchaseStatus = $('#purchase-status-value').val();
        $('.selected').toggleClass('selected');
        $(`#${purchaseStatus.toLowerCase()}`).toggleClass('selected');
    }
})

$('#show-item-form').on('click', function(){
    if($('#new-item-form').css('display') === 'none'){
        $('#new-item-form').toggle();
    }
});

$('#close-add-item').on('click', function(){
    $('#new-item-form input').val('');
    $('#new-item-form').toggle();
})

//-------------- EXCHANGE CREATION PAGE -------------------

// Prevent submission of exchange with less than three people
$('#exchange-setup').submit(function(e){
    console.log("Hit exchange setup JS.")
    // Clear warning message
    $('#exchange-length-warning').html('');

    let formData = $('#exchange-setup').serializeArray();

    // Make list of members from form data. If list length is less than 2,
    // stop submission and display message.
    let participantCheck = [];
    formData.forEach(data => {
        if(data.name === `newExchange[members]`){
            participantCheck.push(data);
        }
    });
    console.log(`participantCheck.length: ${participantCheck.length}`);
    if(participantCheck.length > 1){
        console.log("Greater than 1.")
        return true;
    } else {
        console.log("Less than 1.");
        $('#exchange-length-warning').html('You must add at least two people to your exchange.');
        return false;
    }
})

// Remove friend from list of potential participants, add to added people as hidden input
// This version for the initial click
$('.exchange-friend-notAdded').on("click", function(){
    let friendId = $(this).attr("data-participant-addButton-id");
    let name = $(this).html();
    $(this).remove();

    $('#added-to-exchange').append(
        `
        <li class="exchange-added-friend" data-participant-id='${friendId}'>
        ${name}
        </li>
        `
    )
    // Trying putting it down below to see if it being a child of the form and not a div helps
    // pass it with the post request:
    // This seems to work!
    $('#exchange-setup').append(
        `
        <input type="hidden" name='newExchange[members]' value='${friendId}'></input>
        `
    )
})
// This version for items dynamically added back from participant list
$('#exchange-participant-options').on("click", '.exchange-friend-notAdded', function(){
    let friendId = $(this).attr("data-participant-addButton-id");
    let name = $(this).html();
    $(this).remove();

    $('#added-to-exchange').append(
        `
        <li class="exchange-added-friend" data-participant-id='${friendId}'>
        ${name}
        </li>
        `
    )
    // Trying putting it down below to see if it being a child of the form and not a div helps
    // pass it with the post request:
    // This seems to work!
    $('#exchange-setup').append(
        `
        <input type="hidden" name='newExchange[members]' value='${friendId}'></input>
        `
    )
})

// Remove from list of added people, put back on list of potential
// !!! Need to add this listener to parent or whatever
$('#added-to-exchange').on("click", ".exchange-added-friend", function(){
    let friendId = $(this).attr('data-participant-id');
    let name = $(this).html();
    $(this).remove();

    $('#exchange-participant-options').append(
        `
        <li class="exchange-friend-notAdded" data-participant-addButton-id="${friendId}">
        ${name}
        </li>
        `
    )
    $(`input[value='${friendId}'`).remove();
})