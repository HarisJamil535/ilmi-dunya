const mongoose = require('mongoose');


const groupSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            unique:true,
            required:true,
            trim:true
        },
    },
    {
        timestamps:true,
    }
);

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;