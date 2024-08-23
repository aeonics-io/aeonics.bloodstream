package aeonics.monitoring;

import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import aeonics.Boot;
import aeonics.data.Data;
import aeonics.entity.Registry;
import aeonics.entity.Storage;
import aeonics.manager.Config;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Monitor;
import aeonics.manager.Scheduler;

/**
 * Data is stored in a storage as JSON objects.
 * <ul>
 * <li><b>[year].json</b> contains the daily aggregates for a calendar year (365 data points).</li>
 * <li><b>.day</b> contains the hourly aggregates for the current calendar day (24 data points).</li>
 * <li><b>.hour</b> contains the 10s interval raw data points for the current clock hour (360 data points).</li>
 * <li><b>.metadata</b> contains information about the current hour and current day for consistency across reboots.</li>
 * </ul>
 * 
 * The aggregates contain <code>min, max, sum, avg, std, count</code>.
 */
public class Monitoring 
{
	private AtomicBoolean enabled = new AtomicBoolean(false);
	public void setup()
	{
		Manager.of(Config.class).watch(Monitor.class, "enabled", (key, value) ->
		{
			enabled.set(value.asBool());
			
			if( mx.isThreadCpuTimeSupported() )
			{
				mx.setThreadCpuTimeEnabled(enabled.get());
				Manager.of(Logger.class).config(Monitor.class, "Thread activity monitoring enabled: " + enabled);
			}
			if( mx.isThreadContentionMonitoringSupported() )
			{
				mx.setThreadContentionMonitoringEnabled(enabled.get());
				Manager.of(Logger.class).config(Monitor.class, "Thread contention monitoring enabled: " + enabled);
			}
			
			if( enabled.get() )
			{
				Monitor.addProbe("usage", () ->
				{
					List<Long> ids = Arrays.stream(mx.getAllThreadIds()).boxed().collect(Collectors.toList());
					Data lvl1 = Data.map();
					
					for( long threadId : ids )
					{
						ThreadInfo info = mx.getThreadInfo(threadId);
						if( info == null ) continue;
						
						if( !lvl1.containsKey(""+threadId) )
							lvl1.put(""+threadId, Data.map().put("name", info.getThreadName()));
						Data lvl2 = lvl1.get(""+threadId);
						
						if( mx.isThreadCpuTimeSupported() && mx.isThreadCpuTimeEnabled() )
						{
							lvl2.put("cpu_time", mx.getThreadCpuTime(threadId));
						}
						
						if( mx.isThreadContentionMonitoringSupported() && mx.isThreadContentionMonitoringEnabled() )
						{
							lvl2.put("blocked_count", info.getBlockedCount());
							lvl2.put("blocked_time", info.getBlockedTime() * 1_000_000);
							lvl2.put("waited_count", info.getWaitedCount());
							lvl2.put("waited_time", info.getWaitedTime() * 1_000_000);
						}
					}
					
					return lvl1;
				});
			}
			else
			{
				Monitor.removeProbe("usage");
			}
		});
		
		// next multiple of 10sec
		ZonedDateTime first = ZonedDateTime.ofInstant(
			Instant.ofEpochSecond(
				((ZonedDateTime.now().toEpochSecond() / 10) + 1) * 10
			),
			ZonedDateTime.now().getZone()
		);
		
		Manager.of(Scheduler.class).every(this::tick, 10, ChronoUnit.SECONDS, first);
	}
	
	/**
	 * Prints the number on 2 digits with eventual leading zero if needed
	 * @param value the number
	 * @return number with leading zero
	 */
	private String leadingZeroes(int value)
	{
		if( value >= 10 ) return String.valueOf(value);
		else if( value >= 1 ) return "0" + value;
		else return "00";
	}
	
	/**
	 * Get the storage for monitoring
	 * @return the storage
	 */
	private Storage.Type storage()
	{
		return Registry.of(Storage.class).get(Manager.of(Config.class).get(Monitor.class, "storage").asString());
	}
	
	/**
	 * Clean the intermediate daily and hourly values if needed
	 * @param time the current time
	 */
	private void cleanupIfNeeded(ZonedDateTime time)
	{
		Data meta = storage().getData(".metadata");
		
		boolean dayChanged = meta == null || meta.isEmpty() || 
			meta.asInt("year") != time.getYear() ||
            meta.asInt("month") != time.getMonthValue() ||
            meta.asInt("day") != time.getDayOfMonth();

		boolean hourChanged = dayChanged ||
			meta.asInt("hour") != time.getHour();

		if( dayChanged ) storage().put(".day", Data.map());
		if( hourChanged ) storage().put(".hour", Data.map());
		if( dayChanged || hourChanged )
			storage().put(".metadata", Data.map()
				.put("boot", Boot.BOOT_TIME)
				.put("year", time.getYear())
				.put("month", time.getMonthValue())
				.put("day", time.getDayOfMonth())
				.put("hour", time.getHour())
				);
	}
	
	private synchronized void tick(ZonedDateTime time)
	{
		if( !enabled.get() ) return;
		
		try
		{
			Data data = Data.map().put("threads", getThreadCPU()).put("network", getNetworkUsage());
			time = time.minusSeconds(1);
			cleanupIfNeeded(time);
			
			Storage.Type s = storage();
			String key = "m" + leadingZeroes(time.getMinute()) + "s" + leadingZeroes(time.getSecond()/10*10);
			s.put(".hour", s.getData(".hour").put(key, data));

			if( time.getMinute() == 59 && time.getSecond() >= 50 )
				aggregateHourly(time);
		}
		catch(Exception e)
		{
			Manager.of(Logger.class).info(Monitoring.class, e);
		}
	}
	
	/**
	 * Data is aggregated using Welford's online algorithm
	 * @param time the time
	 */
	private void aggregateHourly(ZonedDateTime time)
	{
		Storage.Type s = storage();
		Data hour = s.getData(".hour");
		
		Data network = null;
		Data threads = Data.map();
		int samples = 0;
		for( int minute = 0; minute < 60; minute++ )
		{
			for( int second = 0; second < 6; second++ )
			{
				String key = "m" + minute + "s" + second + "0";
				Data data = hour.get(key);
				if( data == null || data.isEmpty() ) continue;
				
				samples++;
				
				// network
				{
					if( network == null || !network.isMap() )
					{
						network = Data.map()
							.put("n",  0)
							.put("read",      Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("write", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("connect",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							;
					}
						
					long v = data.get("network").asLong("read");
					Data x = network.get("read");
					x.put("sum", x.asLong("sum") + v);
					double delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = data.get("network").asLong("write");
					x = network.get("write");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = data.get("network").asLong("connect");
					x = network.get("connect");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
				}
				
				for( Map.Entry<String, Data> id : data.get("threads").entrySet() )
				{
					Data values = id.getValue();
					Data t = threads.get(id.getKey());
					
					if( t == null || !t.isMap() )
					{
						t = Data.map()
							.put("name", id.getValue().get("name"))
							.put("n",  0)
							.put("cpu_time",      Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("blocked_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("blocked_time",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("waited_count",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							.put("waited_time",   Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
							;
						threads.put(id.getKey(), t);
					}
					
					long v = values.asLong("cpu_time");
					Data x = t.get("cpu_time");
					x.put("sum", x.asLong("sum") + v);
					double delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("blocked_count");
					x = t.get("blocked_count");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("blocked_time");
					x = t.get("blocked_time");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("waited_count");
					x = t.get("waited_count");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("waited_time");
					x = t.get("waited_time");
					x.put("sum", x.asLong("sum") + v);
					delta = v - x.asDouble("avg");
					x.put("avg", x.asDouble("avg") + (delta / samples));
					x.put("m2", x.asDouble("m2") + (delta * (v - x.asDouble("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
				}
			}
		}
		
		// network
		{
			network.put("n", samples);
			
			Data x = network.get("read");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = network.get("write");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = network.get("connect");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
		}
		
		for( Data t : threads )
		{
			t.put("n", samples);
			
			Data x = t.get("cpu_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = t.get("blocked_count");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = t.get("blocked_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = t.get("waited_count");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
			
			x = t.get("waited_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / samples));
		}
		
		s.put(".day", s.getData(".day").put("h" + leadingZeroes(time.getHour()), Data.map().put("threads", threads).put("network", network)));
		
		if( time.getHour() >= 23 )
			aggregateDaily(time);
	}
	
	/**
	 * Data is aggregated using Parallel algorithm of Welford's online algorithm
	 * @param time the time
	 */
	private void aggregateDaily(ZonedDateTime time)
	{
		Storage.Type s = storage();
		Data all = s.getData(".day");
		
		Data network = null;
		Data threads = Data.map();
		for( int hour = 0; hour < 24; hour++ )
		{
			Data data = all.get("h" + leadingZeroes(hour));
			if( data == null || data.isEmpty() ) continue;
			
			// network
			{
				if( network == null || !network.isMap() )
				{
					network = Data.map()
						.put("n",  0)
						.put("read",      Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
						.put("write", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
						.put("connect",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("m2", 0))
						;
				}
				
				long n = network.asLong("n") + data.get("network").asLong("n");
				
				Data m = data.get("network").get("read");
				Data x = network.get("read");
				x.put("sum", x.asLong("sum") + m.asLong("sum"));
				double delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * data.get("network").asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * data.get("network").asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = data.get("network").get("write");
				x = network.get("write");
				x.put("sum", x.asLong("sum") + m.asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * data.get("network").asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * data.get("network").asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = data.get("network").get("connect");
				x = network.get("connect");
				x.put("sum", x.asLong("sum") + m.asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * data.get("network").asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * data.get("network").asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				network.put("n", n);
			}
			
			for( Map.Entry<String, Data> id : data.entrySet() )
			{
				Data values = id.getValue();
				Data t = threads.get(id.getKey());
				
				if( t == null || !t.isMap() )
				{
					t = Data.map()
						.put("name", id.getValue().get("name"))
						.put("n",  0)
						.put("cpu_time",      Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("m2",  0))
						.put("blocked_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("m2",  0))
						.put("blocked_time",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("m2",  0))
						.put("waited_count",  Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("m2",  0))
						.put("waited_time",   Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("m2",  0))
						;
					threads.put(id.getKey(), t);
				}
				
				long n = t.asLong("n") + values.asLong("n");
				
				Data m = values.get("cpu_time");
				Data x = t.get("cpu_time");
				x.put("sum", x.asLong("sum") + m.asLong("sum"));
				double delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * values.asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * values.asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = values.get("blocked_count");
				x = t.get("blocked_count");
				x.put("sum", x.asLong("sum") + values.get("blocked_count").asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * values.asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * values.asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = values.get("blocked_time");
				x = t.get("blocked_time");
				x.put("sum", x.asLong("sum") + values.get("blocked_time").asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * values.asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * values.asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = values.get("waited_count");
				x = t.get("waited_count");
				x.put("sum", x.asLong("sum") + values.get("waited_count").asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * values.asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * values.asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				m = values.get("waited_time");
				x = t.get("waited_time");
				x.put("sum", x.asLong("sum") + values.get("waited_time").asLong("sum"));
				delta = x.asDouble("avg") - m.asDouble("avg");
				x.put("avg", ((x.asDouble("avg") * x.asLong("n")) + (m.asDouble("avg") * values.asLong("n"))) / n);
			    x.put("m2", x.asDouble("m2") + m.asDouble("m2") + delta * delta * x.asLong("n") * values.asLong("n") / n);
			    if( x.asLong("min") > m.asLong("min") ) x.put("min", m.asLong("min"));
				if( x.asLong("max") < m.asLong("max") ) x.put("max", m.asLong("max"));
				
				t.put("n", n);
			}
		}
		
		// network
		{
			Data x = network.get("read");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = network.get("write");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = network.get("connect");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
		}
		
		for( Data t : threads )
		{
			Data x = t.get("cpu_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = t.get("blocked_count");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = t.get("blocked_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = t.get("waited_count");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
			
			x = t.get("waited_time");
			x.put("std", Math.sqrt(x.asDouble("m2") / x.asLong("n")));
		}
		
		Data year = s.getData(time.getYear() + ".json");
		if( year == null ) year = Data.map();
		
		s.put(time.getYear() + ".json", year.put("m" + leadingZeroes(time.getMonthValue()) + "d" + leadingZeroes(time.getDayOfMonth()), 
				Data.map().put("threads", threads).put("network", network)
				));
	}
	
	private ThreadMXBean mx = ManagementFactory.getThreadMXBean();
	private Data _previousThreadInfo = Data.map();
	
	/**
	 * Returns the thread metrics since last call
	 * @return thread metrics since last call
	 */
	private synchronized Data getThreadCPU()
	{
		ThreadGroup group = Thread.currentThread().getThreadGroup().getParent();
		Thread[] threads = new Thread[group.activeCount()];
		group.enumerate(threads, true);
		List<Long> ids = Arrays.stream(threads).mapToLong(t -> t.getId()).boxed().collect(Collectors.toList());
		
		Monitor.Probe p = Monitor.probe("usage");
		if( p == null ) return Data.map();
		Data currentThreadInfo = Data.map();
		try { currentThreadInfo = p.get(); } catch(Throwable t) { return Data.map(); }
		
		Data lvl1 = Data.map();
		for( long threadId : ids )
		{
			Data now = currentThreadInfo.get("" + threadId);
			if( now == null || now.isEmpty() ) continue;
			
			Data last = _previousThreadInfo.get("" + threadId);
			if( last == null || last.isEmpty() ) last = null;
			
			Data lvl2 = Data.map().put("name", now.get("name"));
			lvl1.put(""+threadId, lvl2);
			
			long past = 0;
			long current = 0;
			
			past = last == null || !last.containsKey("cpu_time") ? 0 : last.asLong("cpu_time");
			current = now == null || !now.containsKey("cpu_time") ? 0 : now.asLong("cpu_time");
			lvl2.put("cpu_time", current - past);
			
			past = last == null || !last.containsKey("blocked_count") ? 0 : last.asLong("blocked_count");
			current = now == null || !now.containsKey("blocked_count") ? 0 : now.asLong("blocked_count");
			lvl2.put("blocked_count", current - past);
			
			past = last == null || !last.containsKey("blocked_time") ? 0 : last.asLong("blocked_time");
			current = now == null || !now.containsKey("blocked_time") ? 0 : now.asLong("blocked_time");
			lvl2.put("blocked_time", current - past);
			
			past = last == null || !last.containsKey("waited_count") ? 0 : last.asLong("waited_count");
			current = now == null || !now.containsKey("waited_count") ? 0 : now.asLong("waited_count");
			lvl2.put("waited_count", current - past);
			
			past = last == null || !last.containsKey("waited_time") ? 0 : last.asLong("waited_time");
			current = now == null || !now.containsKey("waited_time") ? 0 : now.asLong("waited_time");
			lvl2.put("waited_time", current - past);
		}
		
		_previousThreadInfo = currentThreadInfo;
		return lvl1;
	}

	private Data _previousNetworkInfo = Data.map();
	
	/**
	 * Returns the network usage since last call
	 * @return network usage since last call
	 */
	private synchronized Data getNetworkUsage()
	{
		Monitor.Probe p = Monitor.probe("network");
		if( p == null ) return Data.map();
		Data currentNetworkInfo = Data.map();
		try { currentNetworkInfo = p.get(); } catch(Throwable t) { return Data.map(); }
		
		Data network = Data.map();
		
		long past = 0;
		long current = 0;
		
		past = _previousNetworkInfo == null || !_previousNetworkInfo.containsKey("read") ? 0 : _previousNetworkInfo.asLong("read");
		current = currentNetworkInfo == null || !currentNetworkInfo.containsKey("read") ? 0 : currentNetworkInfo.asLong("read");
		network.put("read", current - past);
		
		past = _previousNetworkInfo == null || !_previousNetworkInfo.containsKey("write") ? 0 : _previousNetworkInfo.asLong("write");
		current = currentNetworkInfo == null || !currentNetworkInfo.containsKey("write") ? 0 : currentNetworkInfo.asLong("write");
		network.put("write", current - past);
		
		past = _previousNetworkInfo == null || !_previousNetworkInfo.containsKey("connect") ? 0 : _previousNetworkInfo.asLong("connect");
		current = currentNetworkInfo == null || !currentNetworkInfo.containsKey("connect") ? 0 : currentNetworkInfo.asLong("connect");
		network.put("connect", current - past);
		
		_previousNetworkInfo = currentNetworkInfo;
		return network;
	}
}
