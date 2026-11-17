import {
  Rating as MuiRating,
  type RatingProps as MuiRatingProps
} from '@mui/material';

export interface RatingProps extends MuiRatingProps {}

export const Rating = (props: RatingProps) => {
  return <MuiRating {...props} />;
};
