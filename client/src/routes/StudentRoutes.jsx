import { Routes, Route } from "react-router-dom";
import StudentLayout from "../student/layout/StudentLayout";
import Chapters from "../student/pages/Chapters";
import Home from "../student/pages/Home";
import Subjects from "../student/pages/Subjects";
import Videos from "../student/pages/Videos";
// import Dashboard from "../student/pages/Dashboard";
// import Subjects from "../student/pages/Subjects";
// import Chapters from "../student/pages/Chapters";
// import Notes from "../student/pages/Notes";
// import Test from "../student/pages/Test";
// import Results from "../student/pages/Results";

const StudentRoutes = () => {
  return (
    <Routes>
      <Route element={<StudentLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/chapters" element={<Chapters />} />
        {/* <Route path="/dashboard" element={<Dashboard />} />
        
        <Route path="/notes/:chapterId" element={<Notes />} />
        <Route path="/videos/:chapterId" element={<Videos />} />
        <Route path="/test/:chapterId" element={<Test />} />
        <Route path="/results" element={<Results />} /> */}
      </Route>
    </Routes>
  );
};

export default StudentRoutes;