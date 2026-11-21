import {type ComponentProps} from 'react';
import {type Href, Link} from 'expo-router';

import {openBrowserAsync, WebBrowserPresentationStyle} from 'expo-web-browser';

interface ExternalLinkProps extends Omit<ComponentProps<typeof Link>, 'href'> {
  href: Href & string;
}

const ExternalLink = ({href, ...rest}: ExternalLinkProps) => {
  const handlePress: ExternalLinkProps['onPress'] = async (event) => {
    if (process.env.EXPO_OS !== 'web') {
      // Prevent the default behavior of linking to the default browser on native.
      event.preventDefault();
      await openBrowserAsync(href, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
    }
  };

  return <Link target="_blank" {...rest} href={href} onPress={handlePress} />;
};

export default ExternalLink;
