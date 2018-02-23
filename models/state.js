'use strict';

const mongoose  = require('mongoose');

let Schema  = mongoose.Schema;

let StateSchema = new Schema({
    state_id: Number,
    name: String,
    price: Number,

},{collection: 'state'});

module.exports = mongoose.model('state', StateSchema);
