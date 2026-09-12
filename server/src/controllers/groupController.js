const Group = require('../models/Group');

const createGroup = async (req, res) => {
    try {

        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                sucess: false,
                message: 'Group name is Required'
            });
        }

        const existingGroup = await Group.findOne({ name });
        if (existingGroup) {
            return res.status(400).json({
                sucess: false,
                message: 'Group already exists'
            })
        }
        const group = await Group.create({ name });
        return res.status(201).json({
            sucess: true,
            message: 'Group created sucessfully'
        })

    } catch (error) {
        return res.status(500).json({
            sucess: false,
            message: error.message,
        })

    }
}

const getGroup = async(req, res)=>{
    try{
           const groups = await Group.find().sort({createdAt:-1});
              return res.status(200).json({
            success: true,
            groups,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedGroup = await Group.findByIdAndDelete(id);

        if (!deletedGroup) {
            return res.status(404).json({
                sucess: false,
                message: 'Group Not Found'
            })
        }
        return res.status(200).json({
            sucess: true,
            message: 'Class deleted sucessfully'
        })
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}


module.exports = { createGroup, getGroup ,deleteGroup}