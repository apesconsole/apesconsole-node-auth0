// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('CONST_SITE', new Schema({ 
	siteId: String,
	projectId: String, 
    siteName: String,
	address: String,
	geoTag: {
		lat: String,
		lonG: String	
	},
	siteManager: {
		userId: String,
		contact: String
	},
	siteSupervisor: {
		userId: String,
		contact: String
	},
	siteInventoryAdmin: {
		userId: String,
		contact: String
	}, 
	siteInventoryManager: {
		userId: String,
		contact: String
	},	
	active: Boolean
}),'CONST_SITE');