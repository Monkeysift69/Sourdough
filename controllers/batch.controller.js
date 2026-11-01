const pool = require('../db');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}


exports.getAll = async (req, res) => {

}

exports.getOne = async (req, res) => {

}

exports.create = async (req, res) => {

}

exports.update = async (req, res) => {

}

exports.remove = async (req, res) => {

}
