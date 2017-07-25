// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_USER_MAP', new Schema({ 
	userId: String,
	siteId: String,
    edit: Boolean,
	viewFinance: Boolean,
	export: Boolean,
	approve: Boolean
}),'SITE_USER_MAP');