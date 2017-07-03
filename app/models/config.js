module.exports = {
    'authentication'			: process.env.MONGODB_USR || 'mongodb://localhost:27017/smartcom_user',
	'trafficdatabase'			: process.env.MONGODB_TRAFFIC_DATA || 'mongodb://localhost:27017/trafficdata'
};