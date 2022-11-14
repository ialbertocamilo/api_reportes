const { Model, 
        DataTypes: { INTEGER, STRING } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

/* models */
const User = require('./User');
const Videoteca = require('./Videoteca');
const Vademecum = require('./Vademecum');
const CriterionValueUser = require('./CriterionValueUser');

class UserAction extends Model {
}

UserAction.init({
    score: INTEGER,
    model_type: STRING
},{
    sequelize,
    modelName: 'user_actions',
    tableName: 'user_actions',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

/* relationships */
UserAction.belongsTo(User, {
    foreignKey: 'user_id'
});

UserAction.belongsTo(Videoteca, {
    foreignKey: 'model_id'
});

UserAction.belongsTo(Vademecum, {
    foreignKey: 'model_id'
});

module.exports = UserAction;