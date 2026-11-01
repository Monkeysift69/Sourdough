const pool = require('../db');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

exports.register = async (req, res) => {

}

exports.login = async (req, res) => {

}

exports.logout = async (req, res) => {

}

exports.logout = async (req, res) => {

}

exports.me = async (req, res) => {
    
}