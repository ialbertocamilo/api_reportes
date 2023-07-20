const { Model,
    DataTypes: { INTEGER,  DATE }
} = require('sequelize');

const sequelize = require('../sequelize.js');
const Taxonomie = require('./Taxonomie');

class UserBenefit extends Model {
}

UserBenefit.init({
    user_id: INTEGER,
    status_id: INTEGER,
    benefit_id: INTEGER,
    updated_at:DATE,
    deleted_at:DATE
}, {
    sequelize,
    modelName: 'user_benefits',
    tableName: 'user_benefits',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
});

UserBenefit.belongsTo(Taxonomie, {
    foreignKey: 'status_id',
    as: 'status'

});

module.exports = UserBenefit;