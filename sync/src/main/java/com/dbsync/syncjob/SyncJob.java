package com.dbsync.syncjob;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SyncJob {
	static final Logger logger = LoggerFactory.getLogger(SyncJob.class);

    @Autowired
    private SyncReader syncReader;

    public void startSync() {
        try {
            logger.info("SyncJob Starting DB Sync ...");
            syncReader.dbRead();
        } catch (Exception e) {
            logger.error("Error occurred: ", e);
        } finally {
            logger.info("Ended DB Sync");
        }
    }
}
