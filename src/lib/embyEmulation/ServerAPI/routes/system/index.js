import ping from './ping';
import info from './info';

export default (server, embyEmulation) => {
    ping(server, embyEmulation);
    info(server, embyEmulation);

    server.get('/system/endpoint', async (req, res) => {
        res.send({
            IsLocal: true,
            IsInNetwork: true
        });
    });

    server.get('/System/ActivityLog/Entries', async (req, res) => {
        res.send({
            'Items':[
                {
                    'Id':73,'Name':'robin is online from Tria','ShortOverview':'IP address: 192.168.176.23','Type':'SessionStarted','Date':'2023-09-01T21:44:45.6801443Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':72,'Name':'robin has disconnected from Tria','ShortOverview':'IP address: 192.168.176.23','Type':'SessionEnded','Date':'2023-09-01T21:44:17.5099232Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':71,'Name':'robin has finished playing The Pod Generation on Tria','Type':'VideoPlaybackStopped','Date':'2023-09-01T21:40:16.3516098Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':70,'Name':'robin is playing The Pod Generation on Tria','Type':'VideoPlayback','Date':'2023-09-01T21:34:32.5569758Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':69,'Name':'robin is online from Tria','ShortOverview':'IP address: 192.168.176.23','Type':'SessionStarted','Date':'2023-09-01T21:34:26.9833616Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':68,'Name':'robin is online from Tria','ShortOverview':'IP address: 192.168.176.23','Type':'SessionStarted','Date':'2023-09-01T21:34:26.9754616Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                },{
                    'Id':67,'Name':'robin is online from Firefox','ShortOverview':'IP address: 192.168.176.23','Type':'SessionStarted','Date':'2023-09-01T20:57:07.9534326Z','UserId':'028c5cba37874cfa99d5c2089ff75599','Severity':'Information' 
                }
            ],
            'TotalRecordCount':33,
            'StartIndex':0 
        });
    });

};
