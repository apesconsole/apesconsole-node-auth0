/*
	Apes's Console
*/

const Express  		= require("express");
const bodyParser 	= require('body-parser');
var morgan      	= require('morgan');
var mongoose    	= require('mongoose');
var url 			= require("url");
var app = Express();
var http = require('http').Server(app);
var router = Express.Router();

var logger = require("logging_component");
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var user   = require('./app/models/user'); // get our mongoose model
var menu   = require('./app/models/menu'); 

mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); 

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var port = process.env.PORT || 3003;
// use morgan to log requests to the console
app.use(morgan('dev'));
// Add headers
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});

/*
router.post('/setup', function(req, res) {
  /* create a sample user 
  var ape = new user({ 
	userid		:req.body.userid || req.query.userid,
	password	:req.body.password || req.query.password, 
    name		:req.body.name || req.query.name,
	address		:req.body.address || req.query.address,
	phone		:req.body.phone || req.query.phone,
	type		:'user'
  });

  // save the sample user
  ape.save(function(err) {
    if (err) throw err;
    logger.log('User saved successfully');
    res.json({ success: true });
  });
  res.json({ success: true });
});
*/

router.post('/authenticate', function(req, res) {
  // find the user
  user.findOne({
    userId: req.body.userId
  }, function(err, userData) {
    if (err) throw err;
    if (!userData) {
      res.json({ success: false, message: 'User not found' });
    } else if (userData) {
      // check if password matches
      if (userData.password != req.body.password) {
        res.json({ success: false, message: 'Wrong password' });
      } else {
        // if user is found and password is right
        // create a token
        var token = jwt.sign(userData, app.get('superSecret'), {
          expiresIn : 60 // expires in 1 minute
        });
        // return the information including token as JSON
        res.json({
          success: true,
          message: 'Token Generated',
          token: token
        });
      }   
    }
  });
});  

router.use(function(req, res, next) {
  // check header or url parameters or post parameters for token
  var tokenString = req.body.token || req.query.token || req.headers['x-access-token'];
  // decode token
  if (null != tokenString &&  tokenString.split(' ')[0] == 'Bearer') {
    var token = tokenString.split(' ')[1]
    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Invalid/Expired Token. Please Login Again' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;    
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });

  }
});


router.get('/', function(req, res) {
  res.json({ message: 'Welcome to SmartCom! Please Authenticate to Get Access Token.' });
});

router.get('/user', function(req, res) {
  var userId = req.body.userId || req.query.userId;
  console.log('looking for ->' + userId)
  user.findOne({'userId': userId}, function(err, userData) {
	userData.password = null;
	menu.find({'type': userData.type}, function(err, menuList) {
		res.json({success: true, data: userData, menu: menuList});
	});
  });
});

router.get('/users', function(req, res) {
  user.find({}, function(err, users) {
    res.json({success: true, data: users});
  });
}); 

app.use('/api', router);

app.get('/', function(req, res) {
    res.send('Hello! The API is at http://localhost:' + port + '/api');
});

http.listen(port, () => {				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - JWT ');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + port);
	logger.log('##################################################');
});	



