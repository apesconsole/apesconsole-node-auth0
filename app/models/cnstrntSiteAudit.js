// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var inventorySchema = mongoose.Schema({
		item: String,
		count: String,
		uom: String
	},{ _id : false });
var labourSchema = mongoose.Schema({
		item: String,
		count: String,
		rate: String,
		contractor: String,
		contact: String
	},{ _id : false });
var statusSchema = mongoose.Schema({
		item: String,
		status: String,
		planned_start_date: String,
		planned_end_date: String,
		actual_start_date: String,
		actual_end_date: String,
		risks: String
	},{ _id : false });
// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_AUDIT', new Schema({ 
	siteId: String,
	projectId: String, 
    siteName: String,
	address: String,
	edit: Boolean, //This is set by Service
	approve: Boolean, //This is set by Service
	geoTag: {
		lat: String,
		lonG: String 
	},
	inventory: [
		inventorySchema
	],
	labour: [
		labourSchema
	],
	status: [
		statusSchema
	],
	updatedBy: String,
	updateDate: Date,
	approvedBy: String,
	approvalDate: Date,
    approvedInventory: Boolean,
    approvedLabour: Boolean,
	active: Boolean
}),'SITE_AUDIT');