import { Typography, SvgIcon } from '@mui/material';

export const LoaderState = () => {
  return (
    <>
      <SvgIcon sx={{ width: '64px', height: '64px' }}>
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 3.75C22.6723 3.75 25.3034 4.40905 27.6602 5.66878C30.017 6.92851 32.0267 8.75002 33.5114 10.972C34.996 13.1939 35.9098 15.7478 36.1718 18.4072C36.4337 21.0667 36.0357 23.7497 35.013 26.2186C33.9904 28.6875 32.3746 30.8661 30.3089 32.5614C28.2432 34.2567 25.7912 35.4164 23.1702 35.9378C20.5492 36.4591 17.8401 36.326 15.2829 35.5503C12.7256 34.7745 10.3991 33.3801 8.50952 31.4905"
            stroke="#0045E6"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </svg>
      </SvgIcon>
      <Typography variant="h6">You are being logged out</Typography>
    </>
  );
};
