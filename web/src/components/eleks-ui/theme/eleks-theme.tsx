import { createTheme, type ThemeOptions } from '@mui/material';

const commonOptions = {
  components: {
    MuiSwitch: {
      styleOverrides: {
        thumb: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.switch
            ?.knobFillEnabled
        }),
        track: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.switch?.slideFill
        }),
        switchBase: ({ theme }: any) => ({
          '&.Mui-disabled .MuiSwitch-thumb': {
            backgroundColor: (theme.palette as any)._components?.switch
              ?.knowFillDisabled
          }
        })
      }
    },
    MuiAvatar: {
      styleOverrides: {
        colorDefault: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.avatar?.fill
        })
      }
    },
    MuiSelect: {
      styleOverrides: {
        root: ({ theme }: any) => {
          const input = (theme.palette as any)._components?.input;
          return {
            '&.MuiInput-root::before': {
              borderBottomColor: input?.standard?.enabledBorder
            },
            '&.MuiInput-root:hover:not(.Mui-disabled, .Mui-error)::before': {
              borderBottomColor: input?.standard?.hoverBorder
            },
            '&.MuiFilledInput-root': {
              backgroundColor: input?.filled?.enabledFill
            },
            '&.MuiFilledInput-root:hover:not(.Mui-disabled, .Mui-error)': {
              backgroundColor: input?.filled?.hoverFill
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: input?.outlined?.enabledBorder
            },
            '&:hover:not(.Mui-disabled, .Mui-error) .MuiOutlinedInput-notchedOutline':
            {
              borderColor: input?.outlined?.hoverBorder
            }
          };
        }
      }
    },
    MuiRating: {
      styleOverrides: {
        iconEmpty: ({ theme }: any) => ({
          color: (theme.palette as any)._components?.rating?.enabledBorder
        }),
        iconFilled: ({ theme }: any) => ({
          color: (theme.palette as any)._components?.rating?.activeFill
        })
      }
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.snackbar?.fill
        })
      }
    },
    MuiChip: {
      styleOverrides: {
        colorDefault: ({ theme }: any) => {
          const chip = (theme.palette as any)._components?.chip;
          return {
            '&:hover': {
              backgroundColor: chip?.defaultHoverFill
            },
            '&.Mui-focusVisible': {
              backgroundColor: chip?.defaultFocusFill
            },
            '&.MuiChip-outlined': {
              borderColor: chip?.defaultEnabledBorder
            },
            '& .MuiChip-deleteIcon': {
              color: chip?.defaultCloseFill
            }
          };
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.tooltip?.fill
        })
      }
    },
    MuiBackdrop: {
      styleOverrides: {
        root: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.backdrop?.fill
        })
      }
    },
    MuiAppBar: {
      styleOverrides: {
        colorDefault: ({ theme }: any) => ({
          backgroundColor: (theme.palette as any)._components?.appBar
            ?.defaultFill
        })
      }
    },
    MuiBreadcrumbs: {
      styleOverrides: {
        ol: ({ theme }: any) => ({
          '& > li > button.MuiButtonBase-root': {
            backgroundColor: (theme.palette as any)._components?.breadcrumbs
              ?.collapseFill
          }
        })
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: ({ theme }: any) => {
          const alert = (theme.palette as any)._components?.alert;
          return {
            '&.MuiAlert-standard.MuiAlert-colorError': {
              color: alert?.error?.color,
              backgroundColor: alert?.error?.background
            },
            '&.MuiAlert-standard.MuiAlert-colorWarning': {
              color: alert?.warning?.color,
              backgroundColor: alert?.warning?.background
            },
            '&.MuiAlert-standard.MuiAlert-colorInfo': {
              color: alert?.info?.color,
              backgroundColor: alert?.info?.background
            },
            '&.MuiAlert-standard.MuiAlert-colorSuccess': {
              color: alert?.success?.color,
              backgroundColor: alert?.success?.background
            }
          };
        }
      }
    },
    MuiStepConnector: {
      styleOverrides: {
        line: ({ theme }: any) => ({
          borderColor: (theme.palette as any)._components?.stepper?.connector
        })
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }: any) => {
          const input = (theme.palette as any)._components?.input;
          return {
            '& .MuiInput-root::before': {
              borderBottomColor: input?.standard?.enabledBorder
            },
            '& .MuiInput-root:hover:not(.Mui-disabled, .Mui-error)::before': {
              borderBottomColor: input?.standard?.hoverBorder
            },
            '& .MuiFilledInput-root': {
              backgroundColor: input?.filled?.enabledFill
            },
            '& .MuiFilledInput-root:hover:not(.Mui-disabled, .Mui-error)': {
              backgroundColor: input?.filled?.hoverFill
            },
            '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
              borderColor: input?.outlined?.enabledBorder
            },
            '& .MuiOutlinedInput-root:hover:not(.Mui-disabled, .Mui-error) .MuiOutlinedInput-notchedOutline':
            {
              borderColor: input?.outlined?.hoverBorder
            }
          };
        }
      }
    }
  },
  breakpoints: {
    values: {
      xl: 1536,
      lg: 1200,
      md: 900,
      sm: 600,
      xs: 444
    }
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
    none: 0
  },
  typography: {
    h1: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    h2: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    h3: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    h4: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    h5: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    h6: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    body1: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    body2: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    subtitle1: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    subtitle2: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    overline: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    },
    caption: {
      fontFamily: 'Inter, Helvetica, Arial, sans-serif'
    }
  }
};

const lightOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#0045E6',
      dark: '#0032A6',
      light: '#6291FF',
      contrastText: '#FFFFFF',
      _states: {
        hover: 'rgba(0, 69, 230, 0.04)',
        selected: 'rgba(0, 69, 230, 0.08)',
        focus: 'rgba(0, 69, 230, 0.12)',
        focusVisible: 'rgba(0, 69, 230, 0.3)',
        outlinedBorder: 'rgba(0, 69, 230, 0.5)'
      }
    },
    secondary: {
      main: '#688692',
      dark: '#4C626A',
      light: '#98ACB4',
      contrastText: '#FFFFFF',
      _states: {
        hover: 'rgba(104, 134, 146, 0.04)',
        selected: 'rgba(104, 134, 146, 0.08)',
        focus: 'rgba(104, 134, 146, 0.12)',
        focusVisible: 'rgba(104, 134, 146, 0.3)',
        outlinedBorder: 'rgba(104, 134, 146, 0.5)'
      }
    },
    error: {
      contrastText: '#FFFFFF',
      main: '#D32F2F',
      _states: {
        hover: 'rgba(211, 47, 47, 0.04)',
        outlinedBorder: 'rgba(211, 47, 47, 0.5)',
        focusVisible: 'rgba(211, 47, 47, 0.3)'
      },
      dark: '#C62828'
    },
    warning: {
      contrastText: '#FFFFFF',
      main: '#EF6C00'
    },
    info: {
      contrastText: '#FFFFFF',
      main: '#0288D1'
    },
    success: {
      contrastText: '#FFFFFF',
      main: '#2E7D32'
    },
    _components: {
      switch: {
        knobFillEnabled: '#FAFAFA',
        slideFill: '#000000',
        knowFillDisabled: '#F5F5F5'
      },
      avatar: {
        fill: '#BDBDBD'
      },
      input: {
        standard: {
          enabledBorder: 'rgba(0, 0, 0, 0.42)',
          hoverBorder: '#000000'
        },
        filled: {
          enabledFill: 'rgba(0, 0, 0, 0.06)',
          hoverFill: 'rgba(0, 0, 0, 0.09)'
        },
        outlined: {
          enabledBorder: 'rgba(0, 0, 0, 0.23)',
          hoverBorder: '#000000'
        }
      },
      rating: {
        enabledBorder: 'rgba(0, 0, 0, 0.23)',
        activeFill: '#FFB400'
      },
      snackbar: {
        fill: '#323232'
      },
      chip: {
        defaultCloseFill: '#000000',
        defaultHoverFill: 'rgba(0, 0, 0, 0.12)',
        defaultEnabledBorder: '#BDBDBD',
        defaultFocusFill: 'rgba(0, 0, 0, 0.2)'
      },
      tooltip: {
        fill: 'rgba(97, 97, 97, 0.9)'
      },
      backdrop: {
        fill: 'rgba(0, 0, 0, 0.5)'
      },
      appBar: {
        defaultFill: '#F5F5F5'
      },
      breadcrumbs: {
        collapseFill: '#F5F5F5'
      },
      alert: {
        error: {
          color: '#5F2120',
          background: '#FDEDED'
        },
        warning: {
          color: '#663C00',
          background: '#FFF4E5'
        },
        info: {
          color: '#014361',
          background: '#E5F6FD'
        },
        success: {
          color: '#1E4620',
          background: '#EDF7ED'
        }
      },
      stepper: {
        connector: '#BDBDBD'
      }
    },
    common: {
      white_states: {
        main: '#FFFFFF',
        focusVisible: 'rgba(255, 255, 255, 0.3)'
      }
    },
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
      disabled: 'rgba(0, 0, 0, 0.38)'
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      _states: {
        focusVisible: 'rgba(0, 0, 0, 0.3)'
      }
    }
  }
} as ThemeOptions;

const darkOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#6291FF',
      dark: '#2D6CFF',
      light: '#A6C1FF',
      contrastText: '#FFFFFF',
      _states: {
        hover: 'rgba(98, 145, 255, 0.08)',
        selected: 'rgba(98, 145, 255, 0.16)',
        focus: 'rgba(98, 145, 255, 0.12)',
        focusVisible: 'rgba(98, 145, 255, 0.3)',
        outlinedBorder: 'rgba(98, 145, 255, 0.5)'
      }
    },
    secondary: {
      main: '#B9C6CC',
      dark: '#819AA4',
      light: '#F7FAFC',
      contrastText: 'rgba(0, 0, 0, 0.87)'
    },
    error: {
      contrastText: '#FFFFFF',
      main: '#F44336',
      _states: {
        hover: 'rgba(244, 67, 54, 0.08)',
        outlinedBorder: 'rgba(244, 67, 54, 0.5)',
        focusVisible: 'rgba(244, 67, 54, 0.3)'
      },
      dark: '#D32F2F'
    },
    warning: {
      contrastText: 'rgba(0, 0, 0, 0.87)',
      main: '#FFA726'
    },
    info: {
      contrastText: 'rgba(0, 0, 0, 0.87)',
      main: '#29B6F6'
    },
    success: {
      contrastText: 'rgba(0, 0, 0, 0.87)',
      main: '#66BB6A'
    },
    _components: {
      switch: {
        knobFillEnabled: '#E0E0E0',
        slideFill: 'rgba(255, 255, 255, 0.38)',
        knowFillDisabled: '#757575'
      },
      avatar: {
        fill: '#757575'
      },
      input: {
        standard: {
          enabledBorder: 'rgba(255, 255, 255, 0.42)',
          hoverBorder: '#FFFFFF'
        },
        filled: {
          enabledFill: 'rgba(255, 255, 255, 0.09)',
          hoverFill: 'rgba(255, 255, 255, 0.12)'
        },
        outlined: {
          enabledBorder: 'rgba(255, 255, 255, 0.23)',
          hoverBorder: '#FFFFFF'
        }
      },
      rating: {
        enabledBorder: 'rgba(255, 255, 255, 0.23)',
        activeFill: '#FFB400'
      },
      snackbar: {
        fill: '#2C2C2C'
      },
      chip: {
        defaultCloseFill: '#FFFFFF',
        defaultHoverFill: 'rgba(255, 255, 255, 0.12)',
        defaultEnabledBorder: '#616161',
        defaultFocusFill: 'rgba(255, 255, 255, 0.2)'
      },
      tooltip: {
        fill: 'rgba(97, 97, 97, 0.9)'
      },
      backdrop: {
        fill: 'rgba(0, 0, 0, 0.5)'
      },
      appBar: {
        defaultFill: '#272727'
      },
      breadcrumbs: {
        collapseFill: '#757575'
      },
      alert: {
        error: {
          color: '#F4C7C7',
          background: '#160B0B'
        },
        warning: {
          color: '#FFE2B7',
          background: '#191207'
        },
        info: {
          color: '#B8E7FB',
          background: '#071318'
        },
        success: {
          color: '#CCE8CD',
          background: '#0C130D'
        }
      },
      stepper: {
        connector: '#757575'
      }
    },
    common: {
      white_states: {
        main: '#FFFFFF',
        focusVisible: 'rgba(255, 255, 255, 0.3)'
      }
    },
    action: {
      hover: 'rgba(255, 255, 255, 0.08)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      disabled: 'rgba(255, 255, 255, 0.38)'
    },
    text: {
      primary: '#FFFFFF',
      _states: {
        focusVisible: 'rgba(255, 255, 255, 0.3)'
      }
    }
  }
} as ThemeOptions;

export const eleksLightTheme = createTheme({
  cssVariables: true,
  ...lightOptions,
  ...commonOptions
});

export const eleksDarkTheme = createTheme({
  cssVariables: true,
  ...darkOptions,
  ...commonOptions
});
