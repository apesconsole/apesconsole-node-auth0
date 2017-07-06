// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE', new Schema({ 
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
		{
			item: String,
			count: String,
			uom: String
		}
	],
	labour: [
	 {
            item: String,
            count: String,
            rate: String,
            contractor: String,
            contact: String
        }
	],
	status: [
		{
            item: String,
            status: String,
            planned_start_date: String,
            planned_end_date: String,
            actual_start_date: String,
            actual_end_date: String,
            risks: String
        }
	],
	updatedBy: String,
	updateDate: Date,
	approvedBy: String,
	approvalDate: Date,
    approvedInventory: Boolean,
    approvedLabour: Boolean,
	active: Boolean
}),'SITE');