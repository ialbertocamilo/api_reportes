const { Model, 
        DataTypes: { STRING, INTEGER } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

/*models*/
const CriterionValue = require('./CriterionValue'); 

class Criteria extends Model {
}

Criteria.init({
    name: STRING,
    code: STRING,
},{
    sequelize,
    modelName: 'criteria',
    tableName: 'criteria',
    
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Criteria.hasMany(CriterionValue, {
    foreignKey: 'criterion_id'
})

module.exports = Criteria;