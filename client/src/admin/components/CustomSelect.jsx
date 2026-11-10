import SharedSelect from "../../shared/CustomSelect";

// Admin forms pass records ({ _id, name }); this hands them to the shared dropdown so every dropdown
// in the admin looks and behaves the same.
export const CustomSelect = ({ options = [], ...props }) => (
  <SharedSelect {...props} options={options.map((option) => ({ value: option._id, label: option.name }))} />
);

export default CustomSelect;
