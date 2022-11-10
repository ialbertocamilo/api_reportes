const { Model, 
        DataTypes: { INTEGER } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

class CriterionValueUser extends Model {
}

CriterionValueUser.init({
    user_id: {
        type: INTEGER,
        primaryKey: true
    },
    //user_id: INTEGER,
    criterion_value_id: INTEGER
},{
    sequelize,
    modelName: 'criterion_value_user',
    tableName: 'criterion_value_user',
    timestamps: false
});




module.exports = CriterionValueUser;