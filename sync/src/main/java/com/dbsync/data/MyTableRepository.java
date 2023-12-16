package com.dbsync.data;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MyTableRepository extends JpaRepository<MyTable, Long>{

    List<MyTable> findTopNByCompletionStatus(Integer completionStatus, int topN);
}