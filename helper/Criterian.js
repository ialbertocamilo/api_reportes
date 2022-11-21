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

	if(Instance) return criterianValues;

	if(criterianValues) {
		let _criterianValues = criterianValues.criterion_values[0];

		if(_criterianValues) return _criterianValues.value_text;
		return _criterianValues; 

	} else criterianValues;

	/*return (Instance) ? criterianValues : criterianValues?.criterion_values[0]?.value_text;*/
}
