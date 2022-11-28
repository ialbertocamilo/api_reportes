const moment = require("moment");
const { con } = require("../db");
const {
  groupArrayOfObjects,
  uniqueElements,
  pluckUnique,
} = require("./Helper");

exports.loadUsersSegmented = async (course_id) => {
  // select `id` from `users`
  // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?)
  // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?)
  // where `active` = ?
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${
            index > 0 ? "or" : ""
          } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${
            value.criterion_id
          }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select users.id , users.name,users.lastname,users.surname,users.email, users.document ,sc.grade_average,sc.advanced_percentage,sc.status_id from users
        LEFT OUTER join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id}
        ${join_criterions_values_user} 
        where users.active=1 
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
};

exports.loadUsersSegmentedv2 = async (
    course_id, 
    start_date, end_date, 
    modules, 
    activeUsers, inactiveUsers) => {
  // select `id` from `users`
  // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?)
  // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?)
  // where `active` = ?
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${
            index > 0 ? "or" : ""
          } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${
            value.criterion_id
          }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });

    // USERS FILTERS 
    const queryJoin = start_date || end_date ? `LEFT OUTER` : `INNER`;
    if (start_date)
      start_date_query = ` and date(sc.created_at) >= '${start_date}'`;
    if (end_date) end_date_query = ` and date(sc.created_at) <= '${end_date}'`;

    const modules_query =
      modeules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    const user_active_query = activeUsers ? ` and u.active = 1 ` : ``;
    const user_inactive_query = inactiveUsers ? ` and u.active = 0 ` : ``;

    const [rows] = await con.raw(`
        select 
            users.id, users.name,users.lastname,users.surname,users.email, users.document ,
            sc.grade_average,sc.advanced_percentage,sc.status_id 
        from users u
        
            ${queryJoin} join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id} ${start_date_query} ${end_date_query}

            inner join criterion_value_user cvu on cvu.user_id = u.id
            inner join criterion_values cv on cv.id = cvu.criterion_value_id
            inner join criteria c on c.id = cv.criterion_id

        ${join_criterions_values_user} 

        where 
            users.deleted_at is null
            ${user_active_query} ${user_inactive_query}
            ${modules_query}
        `);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
};

exports.loadCourses = async ({ cursos, escuelas }) => {
  const where_courses =
    cursos.length == 0
      ? {
          label: "cs.school_id",
          value: escuelas,
        }
      : {
          label: "cs.course_id",
          value: cursos,
        };
  return await con("course_school as cs")
    .select("cs.course_id", "c.name as course_name", "sc.name as school_name")
    .join("courses as c", "c.id", "cs.course_id")
    .join("schools as sc", "sc.id", "cs.school_id")
    .whereIn(where_courses.label, where_courses.value)
    .where("c.active", 1)
    .where("c.deleted_at", null)
    .groupBy("cs.course_id");
};
