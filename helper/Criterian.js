const Criterian = require('../models/Criterian');
const CriterionValue = require('../models/CriterionValue');
const CriterionValueUser = require('../models/CriterionValueUser');

exports.getCriterianUserByCode = async (UserId, UserCode, Instance = false ) => {

	const criterianValues = await Criterian.findOne({  	where:{ code: UserCode },
													  	include:[{ 
												  					model: CriterionValue,
													  				include: [{ 
												  								model: CriterionValueUser, 
												  								where: { user_id: UserId }
												  							 }],
													  			}]
										  			});
	return (Instance) ? criterianValues : 
						criterianValues?.criterion_values[0]?.value_text;
}
