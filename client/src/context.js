import React from 'react';

const AppContext = React.createContext(null);
const PageContext = React.createContext(null);
const AdminPanelContext = React.createContext(null);
const AnnouncementBoardContext = React.createContext(null);


export { AppContext as default, PageContext, AdminPanelContext, AnnouncementBoardContext };