import * as React from 'react';
import {
  Box,
  Button,
  Paper,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Grid
} from '@mui/material';

export interface TransferListProps {
  left: string[];
  right: string[];
  setLeft: (items: string[]) => void;
  setRight: (items: string[]) => void;
  leftTitle?: React.ReactNode;
  rightTitle?: React.ReactNode;
  sx?: object;
}

function not(a: readonly string[], b: readonly string[]) {
  return a.filter(value => b.indexOf(value) === -1);
}

function intersection(a: readonly string[], b: readonly string[]) {
  return a.filter(value => b.indexOf(value) !== -1);
}

export const TransferList: React.FC<TransferListProps> = ({
  left,
  right,
  setLeft,
  setRight,
  leftTitle,
  rightTitle,
  sx,
  ...props
}) => {
  const [checked, setChecked] = React.useState<string[]>([]);

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  const handleToggle = (value: string) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const handleAllRight = () => {
    setRight(right.concat(left));
    setLeft([]);
    setChecked(not(checked, left));
  };

  const handleAllLeft = () => {
    setLeft(left.concat(right));
    setRight([]);
    setChecked(not(checked, right));
  };

  const handleCheckedRight = () => {
    setRight(right.concat(leftChecked));
    setLeft(not(left, leftChecked));
    setChecked(not(checked, leftChecked));
  };

  const handleCheckedLeft = () => {
    setLeft(left.concat(rightChecked));
    setRight(not(right, rightChecked));
    setChecked(not(checked, rightChecked));
  };

  const customList = (title: React.ReactNode, items: readonly string[]) => (
    <Paper sx={{ width: 220, height: 300, overflow: 'auto' }}>
      {title && (
        <Box
          sx={{ px: 2, py: 1, borderBottom: '1px solid #eee', fontWeight: 500 }}
        >
          {title}
        </Box>
      )}
      <List
        dense
        component="div"
        role="list"
        sx={{ height: title ? 255 : 300, overflow: 'auto' }}
      >
        {items.map((value: string) => {
          const labelId = `transfer-list-item-${value}-label`;

          return (
            <ListItemButton
              key={value}
              role="listitem"
              onClick={handleToggle(value)}
              sx={{ py: 0.5 }}
            >
              <ListItemIcon>
                <Checkbox
                  checked={checked.indexOf(value) !== -1}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': labelId }}
                  sx={{ p: 0.5 }}
                />
              </ListItemIcon>
              <ListItemText id={labelId} primary={value} />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );

  return (
    <Box sx={{ ...sx }} {...props}>
      <Grid container spacing={2} justifyContent="center" alignItems="center">
        <Grid>{customList(leftTitle, left)}</Grid>
        <Grid>
          <Grid container direction="column" alignItems="center">
            <Button
              sx={{ my: 0.5 }}
              variant="outlined"
              size="small"
              onClick={handleAllRight}
              disabled={left.length === 0}
              aria-label="move all right"
            >
              ≫
            </Button>
            <Button
              sx={{ my: 0.5 }}
              variant="outlined"
              size="small"
              onClick={handleCheckedRight}
              disabled={leftChecked.length === 0}
              aria-label="move selected right"
            >
              &gt;
            </Button>
            <Button
              sx={{ my: 0.5 }}
              variant="outlined"
              size="small"
              onClick={handleCheckedLeft}
              disabled={rightChecked.length === 0}
              aria-label="move selected left"
            >
              &lt;
            </Button>
            <Button
              sx={{ my: 0.5 }}
              variant="outlined"
              size="small"
              onClick={handleAllLeft}
              disabled={right.length === 0}
              aria-label="move all left"
            >
              ≪
            </Button>
          </Grid>
        </Grid>
        <Grid>{customList(rightTitle, right)}</Grid>
      </Grid>
    </Box>
  );
};
