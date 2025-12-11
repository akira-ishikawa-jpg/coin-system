import { GetServerSideProps } from 'next'

export default function HomeRedirect() {
  // This page immediately redirects; nothing to render.
  return null
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  }
}
