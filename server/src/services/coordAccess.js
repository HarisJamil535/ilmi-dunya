// Who may do what in the Coordination area.
//
// Staff are created by the super admin on the Coordination page and given a title:
//   teacher      belongs to one department; views and edits that department's files only
//   coordinator  the department's Subject Coordinator (one per department): also submits and signs
//   sectionHead  one for the school: every department; edits, approves and signs, reopens
//   principal    one for the school: every department; views, comments and downloads (no editing, no signing)
// Super admins and admins with "coordinationManage" manage departments, staff and files (they never sign).
// No department can see another department's files.
const isManager = (admin) => admin?.role === "super_admin" || (admin?.permissions || []).includes("coordinationManage");
const canUseArea = (admin) => isManager(admin) || (admin?.permissions || []).includes("coordination") || Boolean(admin?.coordTitle);
const sameId = (a, b) => Boolean(a) && Boolean(b) && String(a?._id || a) === String(b?._id || b);
const seesEverything = (admin) => isManager(admin) || ["sectionHead", "principal"].includes(admin?.coordTitle);

function roleIn(file, admin) {
    if (!file || !admin) return null;
    if (admin.coordTitle === "sectionHead") return "sectionHead";
    if (admin.coordTitle === "principal") return "principal";
    if (sameId(file.department, admin.coordDepartment)) {
        if (admin.coordTitle === "coordinator") return "coordinator";
        if (admin.coordTitle === "teacher") return "editor";
    }
    return isManager(admin) ? "manager" : null;
}

function capsFor(role, admin) {
    const manager = isManager(admin);
    const has = (...roles) => roles.includes(role);
    return {
        view: Boolean(role),
        comment: Boolean(role),
        download: Boolean(role),
        edit: manager || has("editor", "coordinator", "sectionHead"),
        addWeeks: manager || has("editor", "coordinator", "sectionHead"),
        signCoordinator: has("coordinator"),
        signSectionHead: has("sectionHead"),
        signPrincipal: has("principal"),
        reopen: manager || has("coordinator", "sectionHead"),
        manage: manager,
        // The Subject Coordinator, the Section Head and the Principal can delete one week or many.
        deleteWeek: manager || has("coordinator", "sectionHead", "principal"),
    };
}

// Which files a person can list: everything, their own department, or nothing.
const fileFilter = (admin) => (seesEverything(admin) ? {} : admin?.coordDepartment ? { department: admin.coordDepartment } : { _id: null });
// Who may start a new file for a department.
const canCreateFile = (admin, departmentId) => isManager(admin) || admin?.coordTitle === "sectionHead" || (admin?.coordTitle === "coordinator" && sameId(admin.coordDepartment, departmentId));

module.exports = { isManager, canUseArea, roleIn, capsFor, fileFilter, canCreateFile, seesEverything };
