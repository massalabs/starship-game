import { useLocation, /* other hooks */ } from 'react-router-dom';

const withRouter = (MyComponent: any) => (props: JSX.Element) => {
  const location = useLocation();
  // other hooks
  return <MyComponent {...props} {...{ location, /* ...other hooks */ }} />;
};

export default withRouter;