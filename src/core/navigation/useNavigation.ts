import { useNavigationContext } from './navigationContext';
import { NavigationContextValue } from './types';

export const useNavigation = (): NavigationContextValue => {
  return useNavigationContext();
};
