const { Model, 
        DataTypes: { INTEGER } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

/* models */
const User = require('./User');
const Videoteca = require('./Videoteca');
const CriterionValueUser = require('./CriterionValueUser');

class UserAction extends Model {
}

UserAction.init({
    score: INTEGER
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

module.exports = UserAction;