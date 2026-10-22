import { useMemo } from "react";
import CustomSelect from "./CustomSelect";
import { AuthField } from "../student/components/StudentAuthControls";

// School, then class and section for schools an admin manages; a text box for other schools.
const SchoolFields = ({ value, onChange, errors = {}, schools, loading = false, failed = false }) => {
  const school = useMemo(() => schools.find((item) => item._id === value.schoolId), [schools, value.schoolId]);
  const grade = school?.classes.find((item) => item._id === value.schoolClassId);

  const options = useMemo(() => [
    ...schools.map((item) => ({ value: item._id, label: item.name })),
    { value: "other", label: "My school is not listed" },
    { value: "private", label: "Private Student" },
  ], [schools]);

  const error = (message) => message && <p className="mt-1 text-xs font-semibold text-rose-600">{message}</p>;

  return <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-3">
    <div className="col-span-2">
      <CustomSelect
        label="School"
        value={value.schoolId}
        onChange={(schoolId) => onChange({ schoolId, school: "", schoolClassId: "", schoolSectionId: "" })}
        options={options}
        searchable
        disabled={loading}
        placeholder={loading ? "Loading schools..." : "Select your school"}
      />
      {error(errors.schoolId)}
      {failed && <p className="mt-1 text-xs font-semibold text-amber-600">The school list could not be loaded. You can still choose "My school is not listed" or "Private Student".</p>}
    </div>
    {value.schoolId === "other" && <div className="col-span-2">
      <AuthField label="School name" autoComplete="organization" value={value.school} maxLength={160} onChange={(event) => onChange({ school: event.target.value })} placeholder="Type your school's name" error={errors.school} />
    </div>}
    {school?.classes.length > 0 && <div className={grade?.sections.length ? "" : "col-span-2"}>
      <CustomSelect label="Class" value={value.schoolClassId} onChange={(schoolClassId) => onChange({ schoolClassId, schoolSectionId: "" })} options={school.classes.map((item) => ({ value: item._id, label: item.name }))} placeholder="Select class" />
      {error(errors.schoolClassId)}
    </div>}
    {grade?.sections.length > 0 && <div>
      <CustomSelect label="Section" value={value.schoolSectionId} onChange={(schoolSectionId) => onChange({ schoolSectionId })} options={grade.sections.map((item) => ({ value: item._id, label: item.name }))} placeholder="Select section" />
      {error(errors.schoolSectionId)}
    </div>}
  </div>;
};

export default SchoolFields;
