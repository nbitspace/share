package com.dbsync.syncjob;

import org.apache.tomcat.util.net.SocketWrapperBase.CompletionState;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.dbsync.data.CompletionStatus;
import com.dbsync.data.MyTableRepository;

@Service
public class SyncReader {

    @Value("${com.sync.prop.batch-count}")
    private int batchCount;

    @Autowired
    private MyTableRepository myTableRepository;

    @Autowired
    private SyncSender syncSender;

    public void dbRead() {
        try {
            myTableRepository.findTopNByCompletionStatus(CompletionStatus.NOT_COMPLETED.getVal(), batchCount);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
