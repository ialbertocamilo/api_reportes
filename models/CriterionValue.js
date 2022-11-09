const { Model, 
        DataTypes: { STRING, INTEGER } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');
/*models*/
const CriterionValueUser = require('./CriterionValueUser');

class CriterionValue extends Model {
}

CriterionValue.init({
    criterion_id: INTEGER,
    value_text: STRING,
},{
    sequelize,
    modelName: 'criterion_values',
    tableName: 'criterion_values',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

CriterionValue.hasMany(CriterionValueUser,{
    foreignKey: 'criterion_value_id',
});

module.exports = CriterionValue;