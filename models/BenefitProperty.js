const { Model, 
    DataTypes: { INTEGER, STRING,DATE, BOOLEAN } 
   } = require('sequelize');

const sequelize = require('../sequelize.js');

/* models */
const Taxonomie = require('./Taxonomie'); 

class BenefitProperty extends Model {
}

BenefitProperty.init({
    active: BOOLEAN,
    type_id: INTEGER,
    benefit_id: INTEGER,
    value_date:DATE,
    value_time:DATE,
},{
sequelize,
modelName: 'benefit_properties',
tableName: 'benefit_properties',

createdAt: 'created_at',
updatedAt: 'updated_at'
});

BenefitProperty.belongsTo(Taxonomie, {
    foreignKey: 'type_id',
    as: 'type'
});

module.exports = BenefitProperty;