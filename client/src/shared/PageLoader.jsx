import BookLoader from "./BookLoader";

const PageLoader = ({ label = "Loading ..." }) => (
  <div className="flex min-h-[55vh] items-center justify-center px-4 py-10">
    <BookLoader size={96} label={label} />
  </div>
);

export default PageLoader;
