module.exports = {
    'authentication'			: process.env.MONGODB_USR 			|| 'mongodb://localhost/smartcom_user',
	'trafficdatabase'			: process.env.MONGODB_TRAFFIC_DATA 	|| 'mongodb://localhost/trafficdata',
	'cnstrntdatabase'			: process.env.MONGODB_CNSTRNT_DATA 	|| 'mongodb://localhost/construction'
};