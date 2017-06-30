module.exports = {
    'secret'	: process.env.AUTH_SECRET || 'qwertyuisdwrtew45765yhtrdheqwc34tfgfd',
    'database'	: process.env.MONGODB_USR || 'mongodb://localhost:27017/auth0database'
};