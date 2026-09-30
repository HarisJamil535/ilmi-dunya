import { useEffect, useState } from "react";
import axiosInstance from "../../api/axios";

const useStudentAuthOptions = () => {
  const [options, setOptions] = useState({ channels: { email: false, whatsapp: false }, loading: true });

  useEffect(() => {
    let active = true;
    axiosInstance.get("/students/auth-options").then(({ data }) => {
      if (active) setOptions({ ...data, loading: false });
    }).catch(() => {
      if (active) setOptions({ channels: { email: false, whatsapp: false }, loading: false });
    });
    return () => { active = false; };
  }, []);

  return options;
};

export default useStudentAuthOptions;
