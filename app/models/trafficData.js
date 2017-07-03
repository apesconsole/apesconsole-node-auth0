// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.trafficdatabase); 
var Schema 			= mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('FINALIZED_DATA_SET', new Schema({ 
	month: Number,
	totalPerMonth: Number, 
    maxType: String,
	maxCount: Number,
	minType: String,
	minCount: Number
}),'FINALIZED_DATA_SET');