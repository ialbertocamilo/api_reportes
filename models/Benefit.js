const { Model, 
    DataTypes: { INTEGER, STRING,DATE, BOOLEAN } 
   } = require('sequelize');

const sequelize = require('../sequelize.js');

/* models */
const Taxonomie = require('./Taxonomie'); 
const BenefitProperty = require('./BenefitProperty'); 
const Speaker = require('./Speaker.js');

class Benefit extends Model {
}

Benefit.init({
    title: STRING,
    promotor:STRING,
    active: BOOLEAN,
    type_id: INTEGER,
    speaker_id:INTEGER,
    status_id: INTEGER,
    cupos: INTEGER,
    workspace_id: INTEGER,
    inicio_inscripcion:DATE,
    fin_inscripcion:DATE,
    fecha_liberacion:DATE,

},{
sequelize,
modelName: 'benefits',
tableName: 'benefits',

createdAt: 'created_at',
updatedAt: 'updated_at'
});

Benefit.belongsTo(Taxonomie, {
    foreignKey: 'type_id',
    as: 'type'
});

Benefit.belongsTo(Taxonomie, {
    foreignKey: 'status_id',
    as: 'status'

});
Benefit.belongsTo(Speaker, {
    foreignKey: 'speaker_id',
    as: 'speaker'
});

Benefit.hasMany(BenefitProperty, {
    foreignKey: 'benefit_id',
    as: 'properties'
});

module.exports = Benefit;